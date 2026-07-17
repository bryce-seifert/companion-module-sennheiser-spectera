import type { SpecteraInstance } from './main.js'
import { Color } from './utils.js'

export function UpdateCompositeElements(self: SpecteraInstance): void {
	self.setCompositeElementDefinitions({
		audioMeter: {
			type: 'composite',
			name: 'Audio Meter2',
			description:
				'A gauge meter for an audio level in dBFS. Set "Level" to an audio_level_* variable, e.g. $(spectera:audio_level_dante_in_1_peak).',
			options: [
				{
					type: 'textinput',
					id: 'level',
					label: 'Level (dBFS)',
					default: '-60',
					useVariables: true,
				},
				{
					type: 'textinput',
					id: 'levelRms',
					label: 'RMS Level (dBFS)',
					default: '-60',
					useVariables: true,
				},
			],
			elements: [
				{
					type: 'gauge',
					x: 0,
					y: 0,
					width: 100,
					height: 100,
					opacity: 100,
					orientation: 'vertical',
					reverse: false,
					value: { isExpression: true, value: '$(options:level)' },
					min: -60,
					max: 0,
					origin: -60,
					fillEnabled: true,
					multiColour: true,
					stops: [
						{ value: -60, color: Color.Green, gradient: false },
						{ value: -30, color: Color.Yellow, gradient: false },
						{ value: -10, color: Color.Red, gradient: false },
						{ value: -2, color: Color.White, gradient: false },
					],
				},
				{
					type: 'gauge',
					x: 0,
					y: 0,
					width: 100,
					height: 100,
					opacity: 100,
					orientation: 'vertical',
					reverse: false,
					value: { isExpression: true, value: '$(options:levelRms)' },
					min: -60,
					max: 0,
					origin: -60,
					fillEnabled: false,
					multiColour: false,
					markerEnabled: true,
					markerWidth: 20,
					markerColor: Color.Green,
					trackAmount: 0,
					trackStyle: 'transparent',
				},
			],
		},
		rssiMeter: {
			type: 'composite',
			name: 'RSSI Meter',
			description: 'A gauge meter for RSSI level in dBm. Set "RSSI" to an rssi_* variable.',
			options: [
				{
					type: 'textinput',
					id: 'rssi',
					label: 'RSSI Level (dBm)',
					default: '-90',
					useVariables: true,
				},
			],
			elements: [
				{
					type: 'gauge',
					x: 0,
					y: 0,
					width: 20,
					height: 100,
					opacity: 100,
					orientation: 'vertical',
					stops: [
						{ value: -90, color: Color.SpecteraBlue, gradient: false },
						{ value: -50, color: Color.SpecteraBlue, gradient: false },
					],
					value: { isExpression: true, value: '$(options:rssi)' },
					min: -90,
					max: -50,
					origin: -90,
					fillEnabled: true,
					multiColour: false,
					markerEnabled: false,
					trackAmount: 25,
					trackStyle: 'dimmed',
				},
			],
		},
	})
}
