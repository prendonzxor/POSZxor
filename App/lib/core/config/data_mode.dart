import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter/services.dart';

enum DataMode {
  local,
  api,
}

class AppDataConfig {
  const AppDataConfig._();

  static const String _rawMode = String.fromEnvironment(
    'POS_DATA_MODE',
    defaultValue: 'local',
  );

  static const String _rawApiBaseUrl = String.fromEnvironment(
    'POS_API_BASE_URL',
    defaultValue: 'http://localhost:3010',
  );

  static DataMode get mode {
    final runtime = DataModeController.instance.selectedMode;
    if (runtime != null) return runtime;
    return _parseMode(_rawMode);
  }

  static String get apiBaseUrl {
    final runtime = DataModeController.instance.apiBaseUrl;
    if (runtime != null && runtime.trim().isNotEmpty) return runtime.trim();
    return _rawApiBaseUrl;
  }

  static DataMode _parseMode(String raw) {
    final normalized = raw.trim().toLowerCase();
    if (normalized == 'api') return DataMode.api;
    return DataMode.local;
  }
}

class DataModeController {
  DataModeController._();

  static final DataModeController instance = DataModeController._();

  static const _modeKey = 'pos_data_mode';
  static const _baseUrlKey = 'pos_api_base_url';

  SharedPreferences? _prefs;
  DataMode? _selectedMode;
  String? _apiBaseUrl;

  DataMode? get selectedMode => _selectedMode;
  String? get apiBaseUrl => _apiBaseUrl;
  bool get isConfigured => _selectedMode != null;

  Future<void> ensureInitialized() async {
    if (_prefs != null) return;

    try {
      _prefs = await SharedPreferences.getInstance();
    } on MissingPluginException {
      // Fallback for environments where the plugin is not registered yet.
      // Runtime will continue with in-memory values and dart-define defaults.
      _prefs = null;
      return;
    }

    final rawMode = _prefs?.getString(_modeKey);
    final rawBaseUrl = _prefs?.getString(_baseUrlKey);

    if (rawMode != null) {
      _selectedMode = rawMode.toLowerCase() == 'api' ? DataMode.api : DataMode.local;
    }
    if (rawBaseUrl != null && rawBaseUrl.trim().isNotEmpty) {
      _apiBaseUrl = rawBaseUrl.trim();
    }
  }

  Future<void> save({
    required DataMode mode,
    String? apiBaseUrl,
  }) async {
    await ensureInitialized();
    _selectedMode = mode;
    await _prefs?.setString(_modeKey, mode.name);

    if (mode == DataMode.api) {
      final value = (apiBaseUrl ?? '').trim();
      if (value.isNotEmpty) {
        _apiBaseUrl = value;
        await _prefs?.setString(_baseUrlKey, value);
      }
    } else {
      _apiBaseUrl = null;
      await _prefs?.remove(_baseUrlKey);
    }
  }
}
