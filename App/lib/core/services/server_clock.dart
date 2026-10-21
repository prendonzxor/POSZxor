import 'dart:async';
import 'dart:convert';
import 'dart:io';

/// Server wall time advanced exclusively with a monotonic stopwatch.
class ServerClock {
  ServerClock._();
  static final instance = ServerClock._();
  DateTime? _anchor;
  String? _apiBaseUrl;
  final Stopwatch _elapsed = Stopwatch();
  Future<void>? _pending;
  Timer? _refresh;
  String? timeZone;
  String? lastError;

  DateTime get now {
    final anchor = _anchor;
    if (anchor == null) throw StateError('Server time is not synchronized');
    return anchor.add(_elapsed.elapsed);
  }

  Future<void> synchronize([String? apiBaseUrl]) {
    if (apiBaseUrl != null) _apiBaseUrl = apiBaseUrl;
    if (_apiBaseUrl == null) {
      return Future<void>.error(StateError('Server URL is not configured'));
    }
    return _pending ??= _synchronize().whenComplete(() => _pending = null);
  }

  Future<void> _synchronize() async {
    final client = HttpClient()
      ..connectionTimeout = const Duration(seconds: 10);
    final transit = Stopwatch()..start();
    try {
      final request =
          await client.getUrl(Uri.parse(_apiBaseUrl!).resolve('/api/time'));
      final response =
          await request.close().timeout(const Duration(seconds: 10));
      if (response.statusCode != 200) {
        throw HttpException(
            'Server time request failed: ${response.statusCode}');
      }
      final body = await response
          .transform(utf8.decoder)
          .join()
          .timeout(const Duration(seconds: 10));
      final data = jsonDecode(body) as Map<String, dynamic>;
      final epoch = data['epochMilliseconds'];
      if (epoch is! num || !epoch.isFinite || data['timeZone'] is! String) {
        throw const FormatException('Invalid server time');
      }
      _anchor = DateTime.fromMillisecondsSinceEpoch(epoch.round(), isUtc: true)
          .add(Duration(microseconds: transit.elapsedMicroseconds ~/ 2));
      _elapsed
        ..reset()
        ..start();
      timeZone = data['timeZone'] as String;
      lastError = null;
    } finally {
      client.close(force: true);
    }
  }

  void start(String apiBaseUrl) {
    _apiBaseUrl = apiBaseUrl;
    _refresh?.cancel();
    void refresh() {
      unawaited(synchronize().catchError((Object error) {
        lastError = error.toString();
      }));
    }

    refresh();
    _refresh = Timer.periodic(const Duration(minutes: 1), (_) => refresh());
  }

  void stop() {
    _refresh?.cancel();
    _refresh = null;
  }
}
