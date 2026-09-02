import { describe, expect, it } from 'vitest'
import type {
	CompanionMigrationAction,
	CompanionMigrationFeedback,
	CompanionStaticUpgradeProps,
	ExpressionOrValue,
	JsonValue,
} from '@companion-module/base'
import type { ModuleConfig, ModuleSecrets } from '../../src/config.js'
import { UpgradeScripts } from '../../src/upgrades.js'
import { AntennaPortId, InputSource, RFChannels, RfState } from '../../src/types.js'

const option = (value: JsonValue): ExpressionOrValue<JsonValue> => ({ isExpression: false, value })

function action(actionId: string, options: CompanionMigrationAction['options']): CompanionMigrationAction {
	return { id: actionId, controlId: 'control-1', actionId, options }
}

function feedback(feedbackId: string, options: CompanionMigrationFeedback['options']): CompanionMigrationFeedback {
	return { id: feedbackId, controlId: 'control-1', feedbackId, options }
}

function props(
	actions: CompanionMigrationAction[] = [],
	feedbacks: CompanionMigrationFeedback[] = [],
): CompanionStaticUpgradeProps<ModuleConfig, ModuleSecrets> {
	return { config: { host: '192.0.2.1' }, secrets: { password: 'secret' }, actions, feedbacks }
}

const context = { currentConfig: { host: '192.0.2.1' } }

describe('LED color upgrade', () => {
	it('migrates legacy antenna and mobile-device brightness values', () => {
		const dadAction = action('dadLedBrightness', { dad: option('a'), ledBrightness: option('Bright') })
		const mobileFeedback = feedback('mobileDeviceLedBrightness', {
			serial: option('SEK-001'),
			brightness: option('Dim'),
		})

		const result = UpgradeScripts[0](context, props([dadAction], [mobileFeedback]))

		expect(result.updatedActions[0]).toMatchObject({
			actionId: 'dadConnectedStateColor',
			options: { dad: option('a'), rfActive: option('#00FF00'), rfMuted: option('#FFD700') },
		})
		expect(result.updatedFeedbacks[0]).toMatchObject({
			feedbackId: 'mobileDeviceConnectedStateColor',
			options: { serial: option('SEK-001'), connectedStateColor: option('#008700') },
		})
	})

	it('leaves unrelated controls out of the upgrade result', () => {
		const result = UpgradeScripts[0](context, props([action('unrelated', {})], [feedback('unrelated', {})]))
		expect(result.updatedActions).toEqual([])
		expect(result.updatedFeedbacks).toEqual([])
	})
})

describe('audio interface upgrades', () => {
	it('adds the disabled command context only when missing', () => {
		const missing = action('setAudioOutputInterface', {})
		const existing = action('setAudioOutputInterface', { context: option('enabled') })
		const confirm = feedback('confirmPending', {})

		const result = UpgradeScripts[1](context, props([missing, existing], [confirm]))

		expect(missing.options.context).toEqual(option('disabled'))
		expect(existing.options.context).toEqual(option('enabled'))
		expect(confirm.options.setAudioOutputInterface_context).toEqual(option('disabled'))
		expect(result.updatedActions).toEqual([missing])
	})

	it('migrates legacy input source values in actions and feedbacks', () => {
		const inputAction = action('setAudioInputInterface', {
			interface: option('dante'),
			toggleInterface: option('madi2'),
		})
		const inputFeedback = feedback('audioInputInterface', { interface: option('madi1') })
		const confirm = feedback('confirmPending', { setAudioInputInterface_interface: option('dante') })

		const result = UpgradeScripts[2](context, props([inputAction], [inputFeedback, confirm]))

		expect(inputAction.options.interface).toEqual(option(InputSource.Dante))
		expect(inputAction.options.toggleInterface).toEqual(option(InputSource['MADI 2']))
		expect(inputFeedback.options.interface).toEqual(option(InputSource['MADI 1']))
		expect(confirm.options.setAudioInputInterface_interface).toEqual(option(InputSource.Dante))
		expect(result.updatedActions).toEqual([inputAction])
		expect(result.updatedFeedbacks).toEqual([inputFeedback, confirm])
	})
})

describe('confirmation default upgrade', () => {
	it('backfills all missing static options while preserving existing values', () => {
		const confirm = feedback('confirmPending', { rfFrequency_rfChannel: option(1) })

		const result = UpgradeScripts[3](context, props([], [confirm]))

		expect(confirm.options).toMatchObject({
			rfFrequency_rfChannel: option(1),
			setAudioInputInterface_interface: option(InputSource.Dante),
			setAudioInputInterface_mode: option('On'),
			dadRfBinding_dad: option(AntennaPortId.A),
			dadRfBinding_rfChannel: option(RFChannels['RF Channel 1']),
			setAudioOutputInterface_interface: option('commandModeAudioNetwork'),
			setAudioOutputInterface_context: option('disabled'),
			setAudioOutputInterface_mode: option('On'),
			setRfChannelState_rfChannel: option(0),
			setRfChannelState_state: option(RfState.Active),
		})
		expect(result.updatedFeedbacks).toEqual([confirm])
	})

	it('does not report an already-complete feedback as changed', () => {
		const complete = feedback('confirmPending', {
			rfFrequency_rfChannel: option(0),
			setAudioInputInterface_interface: option(InputSource.Dante),
			setAudioInputInterface_mode: option('On'),
			dadRfBinding_dad: option(AntennaPortId.A),
			dadRfBinding_rfChannel: option(RFChannels['RF Channel 1']),
			setAudioOutputInterface_interface: option('commandModeAudioNetwork'),
			setAudioOutputInterface_context: option('disabled'),
			setAudioOutputInterface_mode: option('On'),
			setRfChannelState_rfChannel: option(0),
			setRfChannelState_state: option(RfState.Active),
		})

		const result = UpgradeScripts[3](context, props([], [complete]))
		expect(result.updatedFeedbacks).toEqual([])
	})
})
