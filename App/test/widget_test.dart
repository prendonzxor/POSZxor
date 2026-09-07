import 'package:flutter_test/flutter_test.dart';

import 'package:poszxor_app/main.dart';

void main() {
  testWidgets('Splash screen shows app name', (WidgetTester tester) async {
    await tester.pumpWidget(const PosZxorApp());

    expect(find.text('POS ZXor'), findsOneWidget);
  });
}
