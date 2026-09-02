import { describe, expect, it, vi } from 'vitest'
import { AudiolinkModeId, MtType, type AudioLink } from '../../src/types.js'
import { makeAudioInput, makeAudioOutput, makeSekDevice, makeSkmDevice } from '../fixtures/devices.js'
import { makeApi } from '../helpers/mock-api.js'

describe('audio-link cleanup', () => {
	it('leaves links referenced by another output in place', async () => {
		const { api, state, instance } = makeApi()
		state.updateAudioOutput(makeAudioOutput({ outputId: 1, micAudiolinkId: 20 }))
		const deleteLink = vi.spyOn(api, 'deleteAudioLink').mockResolvedValue()

		await api.cleanupAudioLink(20, {}, 'Test cleanup')

		expect(deleteLink).not.toHaveBeenCalled()
		expect(instance.log).toHaveBeenCalledWith('debug', 'Test cleanup: link 20 still in use, leaving in place')
	})

	it('unlinks stale device references before deleting an abandoned link', async () => {
		const { api, state } = makeApi()
		const device = makeSkmDevice({ mtUid: 7, micAudiolinkId: 20 })
		state.updateMobileDevice(device)
		const setDevice = vi.spyOn(api, 'setMobileDevice').mockResolvedValue()
		const deleteLink = vi.spyOn(api, 'deleteAudioLink').mockResolvedValue()

		await api.cleanupAudioLink(20)

		expect(setDevice).toHaveBeenCalledWith(7, { micAudiolinkId: -1 })
		expect(deleteLink).toHaveBeenCalledWith(20)
		expect(device.micAudiolinkId).toBe(-1)
		expect(setDevice.mock.invocationCallOrder[0]).toBeLessThan(deleteLink.mock.invocationCallOrder[0])
	})
})

describe('IEM input routing', () => {
	it('creates a link, assigns the input, then assigns the SEK device', async () => {
		const { api, state } = makeApi()
		state.updateAudioInput(makeAudioInput({ inputId: 3 }))
		state.updateMobileDevice(makeSekDevice({ mtUid: 8, rfChannelId: 1 }))
		const createLink = vi.spyOn(api, 'createAudioLink').mockResolvedValue(30)
		const setInput = vi.spyOn(api, 'setAudioInput').mockResolvedValue()
		const setDevice = vi.spyOn(api, 'setMobileDevice').mockResolvedValue()

		await api.routeAudioInputToMobileDevice(3, 8, AudiolinkModeId['LIVE (Stereo)'])

		expect(createLink).toHaveBeenCalledWith({ modeId: AudiolinkModeId['LIVE (Stereo)'], rfChannelId: 1 })
		expect(setInput).toHaveBeenCalledWith(3, { iemAudiolinkId: 30 })
		expect(setDevice).toHaveBeenCalledWith(8, { iemAudiolinkId: 30 })
		expect(createLink.mock.invocationCallOrder[0]).toBeLessThan(setInput.mock.invocationCallOrder[0])
		expect(setInput.mock.invocationCallOrder[0]).toBeLessThan(setDevice.mock.invocationCallOrder[0])
	})

	it('does not create a link when the device has no RF channel', async () => {
		const { api, state, instance } = makeApi()
		state.updateAudioInput(makeAudioInput())
		state.updateMobileDevice(makeSekDevice({ rfChannelId: undefined }))
		const createLink = vi.spyOn(api, 'createAudioLink').mockResolvedValue(30)

		await api.routeAudioInputToMobileDevice(0, 1, AudiolinkModeId['LIVE (Stereo)'])

		expect(createLink).not.toHaveBeenCalled()
		expect(instance.log).toHaveBeenCalledWith('warn', 'Audio Routing: Mobile Device has no RF Channel assigned')
	})
})

describe('microphone output routing', () => {
	it('reuses an existing link and updates its mode only when needed', async () => {
		const { api, state } = makeApi()
		const device = makeSkmDevice({ mtUid: 4, micAudiolinkId: 40 })
		const output = makeAudioOutput({ outputId: 2 })
		state.updateMobileDevice(device)
		state.updateAudioOutput(output)
		state.updateAudioLink({
			audiolinkId: 40,
			rfChannelId: 0,
			modeId: AudiolinkModeId['RAW (Mono)'],
		} satisfies AudioLink)
		const createLink = vi.spyOn(api, 'createAudioLink').mockResolvedValue(99)
		const updateLink = vi.spyOn(api, 'updateAudioLink').mockResolvedValue()
		const setDevice = vi.spyOn(api, 'setMobileDevice').mockResolvedValue()
		const setOutput = vi.spyOn(api, 'setAudioOutput').mockResolvedValue()

		await api.routeMobileDeviceToAudioOutput(4, 2, AudiolinkModeId['RAW Low Latency (Mono)'])

		expect(createLink).not.toHaveBeenCalled()
		expect(updateLink).toHaveBeenCalledWith({
			audiolinkId: 40,
			modeId: AudiolinkModeId['RAW Low Latency (Mono)'],
		})
		expect(setDevice).not.toHaveBeenCalled()
		expect(setOutput).toHaveBeenCalledWith(2, { micAudiolinkId: 40 })
		expect(output.micAudiolinkId).toBe(40)
	})

	it('creates and assigns a new link to both device and output', async () => {
		const { api, state } = makeApi()
		const device = makeSkmDevice({ mtUid: 4, micAudiolinkId: -1, rfChannelId: 0 })
		const output = makeAudioOutput({ outputId: 2 })
		state.updateMobileDevice(device)
		state.updateAudioOutput(output)
		const createLink = vi.spyOn(api, 'createAudioLink').mockResolvedValue(41)
		const setDevice = vi.spyOn(api, 'setMobileDevice').mockResolvedValue()
		const setOutput = vi.spyOn(api, 'setAudioOutput').mockResolvedValue()

		await api.routeMobileDeviceToAudioOutput(4, 2, AudiolinkModeId['RAW (Mono)'])

		expect(createLink).toHaveBeenCalledWith({ modeId: AudiolinkModeId['RAW (Mono)'], rfChannelId: 0 })
		expect(setDevice).toHaveBeenCalledWith(4, { micAudiolinkId: 41 })
		expect(setOutput).toHaveBeenCalledWith(2, { micAudiolinkId: 41 })
		expect(device.micAudiolinkId).toBe(41)
		expect(output.micAudiolinkId).toBe(41)
	})

	it('does not delete a replaced link that another output still uses', async () => {
		const { api, state } = makeApi()
		state.updateMobileDevice(makeSkmDevice({ mtUid: 4, micAudiolinkId: 41 }))
		state.updateAudioOutput(makeAudioOutput({ outputId: 2, micAudiolinkId: 40 }))
		state.updateAudioOutput(makeAudioOutput({ outputId: 3, micAudiolinkId: 40 }))
		state.updateAudioLink({
			audiolinkId: 41,
			rfChannelId: 0,
			modeId: AudiolinkModeId['RAW (Mono)'],
		})
		const deleteLink = vi.spyOn(api, 'deleteAudioLink').mockResolvedValue()
		vi.spyOn(api, 'setAudioOutput').mockResolvedValue()

		await api.routeMobileDeviceToAudioOutput(4, 2, AudiolinkModeId['RAW (Mono)'])

		expect(deleteLink).not.toHaveBeenCalled()
	})

	it('does not treat IEM references as microphone output ownership', () => {
		const { api, state } = makeApi()
		state.updateMobileDevice(makeSekDevice({ type: MtType.SEK, iemAudiolinkId: 55 }))
		expect(api.isAudioLinkAbandoned(55)).toBe(false)
	})
})
