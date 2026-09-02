import {
	MicLowCutHzSEK,
	MicLowCutHzSKM,
	MtState,
	MtType,
	type MobileDevice,
	type SEKDevice,
	type SKMDevice,
} from '../../src/types.js'

export function makeSekDevice(overrides: Partial<SEKDevice> = {}): SEKDevice {
	return {
		mtUid: 1,
		type: MtType.SEK,
		identify: false,
		name: 'SEK 1',
		serial: 'SEK-001',
		sleep: false,
		state: MtState.Connected,
		headphoneVolume: 0,
		headphoneBalance: 0,
		micPreampGain: 0,
		micLowCutHz: MicLowCutHzSEK.Off,
		...overrides,
	}
}

export function makeSkmDevice(overrides: Partial<SKMDevice> = {}): SKMDevice {
	return {
		mtUid: 2,
		type: MtType.SKM,
		identify: false,
		name: 'SKM 1',
		serial: 'SKM-001',
		sleep: false,
		state: MtState.Connected,
		micPreampGain: 0,
		micLowCutHz: MicLowCutHzSKM.Off,
		...overrides,
	}
}

export function makeMobileDevice(overrides: Partial<MobileDevice> = {}): MobileDevice {
	return makeSekDevice(overrides as Partial<SEKDevice>)
}
