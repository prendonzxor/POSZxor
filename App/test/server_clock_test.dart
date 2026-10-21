// Run with: dart run test/server_clock_test.dart
// This exercises the actual mobile clock without Flutter's rendering engine.
import 'dart:convert';
import 'dart:io';
import 'package:poszxor_app/core/services/server_clock.dart';

void check(bool condition, String message) {
  if (!condition) throw StateError(message);
}

Future<void> main() async {
  final clock = ServerClock.instance;
  var unavailable = false;
  try {
    clock.now;
  } on StateError {
    unavailable = true;
  }
  check(unavailable, 'Must not use device time before synchronization');
  final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
  final epoch = DateTime.parse('2000-01-01T00:00:00Z').millisecondsSinceEpoch;
  var fail = false;
  var requests = 0;
  final subscription = server.listen((request) async {
    requests++;
    check(request.uri.path == '/api/time', 'Incorrect endpoint');
    request.response.statusCode = fail ? 503 : 200;
    request.response.headers.contentType = ContentType.json;
    request.response.write(jsonEncode({
      'epochMilliseconds': epoch,
      'serverTime': '2000-01-01T00:00:00Z',
      'timeZone': 'America/Mexico_City',
    }));
    await request.response.close();
  });
  try {
    final url = 'http://127.0.0.1:${server.port}';
    await Future.wait([clock.synchronize(url), clock.synchronize(url)]);
    check(requests == 1, 'Concurrent synchronization must share the request');
    check(clock.now.isUtc && clock.now.year == 2000,
        'Clock must use server epoch');
    check(clock.timeZone == 'America/Mexico_City', 'Server timezone missing');
    final before = clock.now;
    await Future<void>.delayed(const Duration(milliseconds: 20));
    check(clock.now.isAfter(before), 'Clock must advance monotonically');
    fail = true;
    var rejected = false;
    try {
      await clock.synchronize();
    } on HttpException {
      rejected = true;
    }
    check(rejected, 'Server errors must not be ignored');
    check(clock.now.year == 2000, 'Offline refresh must retain server time');
    stdout.writeln('Mobile server-clock integration test passed.');
  } finally {
    clock.stop();
    await subscription.cancel();
    await server.close(force: true);
  }
}
