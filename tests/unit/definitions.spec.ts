import { describe, expect, it, vi } from 'vitest'
import { UpdateActions } from '../../src/actions.js'
import { UpdateFeedbacks } from '../../src/feedbacks.js'
import { UpdateCompositeElements } from '../../src/graphics.js'
import { SpecteraState } from '../../src/state.js'
import { InputSource, InterfaceInputStatus, RfState } from '../../src/types.js'
import { makeAudioInput, makeSekDevice } from '../fixtures/devices.js'

function makeInstance() {
	const state = new SpecteraState()
	const instance = {
		state,
		api: {
			setRfChannel: vi.fn().mockResolvedValue(undefined),
			setAudioInput: vi.fn().mockResolvedValue(undefined),
		},
		confirmationKey: vi.fn((id: string) => `${id}:key`),
		confirmAction: vi.fn(() => true),
		pendingConfirmations: new Map<string, NodeJS.Timeout>(),
		setActionDefinitions: vi.fn(),
		setFeedbackDefinitions: vi.fn(),
		setCompositeElementDefinitions: vi.fn(),
		checkFeedbacks: vi.fn(),
		log: vi.fn(),
	}
	return instance
}

function registeredDefinitions(setter: ReturnType<typeof vi.fn>): Record<string, any> {
	return setter.mock.calls[0][0]
}

describe('action definitions', () => {
	it('registers the complete action surface and translates RF frequency to kHz', async () => {
		const instance = makeInstance()
		UpdateActions(instance as any)
		const actions = registeredDefinitions(instance.setActionDefinitions)

		expect(Object.keys(actions)).toHaveLength(32)
		await actions.rfFrequency.callback({
			options: { rfChannel: 1, frequency: '475.125', requireConfirmation: false },
		})
		expect(instance.api.setRfChannel).toHaveBeenCalledWith(1, { rfChannelId: 1, frequency: 475125 })
	})

	it('does not execute a confirmable action until confirmation succeeds', async () => {
		const instance = makeInstance()
		instance.confirmAction.mockReturnValue(false)
		UpdateActions(instance as any)
		const actions = registeredDefinitions(instance.setActionDefinitions)

		await actions.setRfChannelState.callback({
			options: { rfChannel: 0, state: RfState.Active, requireConfirmation: true },
		})
		expect(instance.confirmationKey).toHaveBeenCalledWith('setRfChannelState', {
			rfChannel: 0,
			state: RfState.Active,
		})
		expect(instance.api.setRfChannel).not.toHaveBeenCalled()
	})

	it('toggles an audio input away from its current interface', async () => {
		const instance = makeInstance()
		instance.state.updateAudioInput(makeAudioInput({ inputId: 2, inputSource: InputSource.Dante, iemAudiolinkId: 20 }))
		UpdateActions(instance as any)
		const actions = registeredDefinitions(instance.setActionDefinitions)

		await actions.setAudioInputInterface.callback({
			options: {
				inputId: [2],
				interface: InputSource.Dante,
				mode: 'Toggle',
				toggleInterface: InputSource['MADI 1'],
				requireConfirmation: false,
			},
		})
		expect(instance.api.setAudioInput).toHaveBeenCalledWith(2, { inputSource: InputSource['MADI 1'] })
	})
})

describe('feedback definitions', () => {
	it('registers feedbacks and evaluates live-style metering data', async () => {
		const instance = makeInstance()
		instance.state.audioLevels = { updateCounter: 4, aoIpIn: { rms: [-30, -12], peak: [-25, -8] } }
		UpdateFeedbacks(instance as any)
		const feedbacks = registeredDefinitions(instance.setFeedbackDefinitions)

		expect(Object.keys(feedbacks).length).toBeGreaterThan(50)
		await expect(
			feedbacks.audioLevelThreshold.callback({ options: { interface: 'danteIn', channel: '2', threshold: '-10' } }),
		).resolves.toBe(true)
		await expect(
			feedbacks.audioLevelThreshold.callback({ options: { interface: 'danteIn', channel: '1', threshold: '-10' } }),
		).resolves.toBe(false)
	})

	it('reads nested interface status and matches a pending confirmation key', async () => {
		const instance = makeInstance()
		instance.state.madi1 = {
			inputStatus: { status: InterfaceInputStatus.Locked },
			outputStatus: { clockSourceStatus: InterfaceInputStatus.Unlocked },
		} as any
		instance.state.updateMobileDevice(makeSekDevice())
		instance.pendingConfirmations.set(
			'rfFrequency:key',
			setTimeout(() => undefined, 1000),
		)
		UpdateFeedbacks(instance as any)
		const feedbacks = registeredDefinitions(instance.setFeedbackDefinitions)

		await expect(
			feedbacks.audioInterfaceStatus.callback({
				options: { interface: 'madi1In', status: InterfaceInputStatus.Locked },
			}),
		).resolves.toBe(true)
		await expect(
			feedbacks.confirmPending.callback({
				options: { actionType: 'rfFrequency', rfFrequency_rfChannel: 0, rfFrequency_frequency: '474' },
			}),
		).resolves.toBe(true)
	})
})

describe('composite element definitions', () => {
	it('registers signal, audio, and RSSI meters with their boundary expressions', () => {
		const instance = makeInstance()
		UpdateCompositeElements(instance as any)
		const elements = registeredDefinitions(instance.setCompositeElementDefinitions)

		expect(Object.keys(elements)).toEqual(['signalBars', 'audioMeter', 'rssiMeter'])
		expect(elements.signalBars.elements).toHaveLength(8)
		expect(elements.audioMeter.elements).toHaveLength(4)
		expect(elements.audioMeter.elements[0].value.value).toContain('max(0, min(100')
		expect(elements.audioMeter.elements[2].enabled.value).toContain('stereo')
		expect(elements.rssiMeter.elements[0]).toMatchObject({ min: -90, max: -30, origin: -90 })
	})
})
