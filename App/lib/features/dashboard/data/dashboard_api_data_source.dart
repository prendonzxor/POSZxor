import 'dart:convert';
import 'dart:io';

import '../../../core/config/data_mode.dart';
import '../domain/dashboard_overview.dart';
import 'dashboard_data_source.dart';

class DashboardApiDataSource implements DashboardDataSource {
  const DashboardApiDataSource({this.authToken});

  final String? authToken;

  @override
  Future<DashboardOverview> getOverview() async {
    final baseUri = Uri.parse(AppDataConfig.apiBaseUrl);
    final uri = baseUri.resolve('/api/analytics/overview?days=7');

    final client = HttpClient();
    try {
      final request = await client.getUrl(uri);
      request.headers.contentType = ContentType.json;

      final token = authToken?.trim();
      if (token != null && token.isNotEmpty) {
        request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $token');
      }

      final response = await request.close();
      final responseBody = await response.transform(utf8.decoder).join();

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw HttpException(
          'Analytics API request failed: ${response.statusCode} ${response.reasonPhrase}',
          uri: uri,
        );
      }

      final dynamic decoded = jsonDecode(responseBody);
      final summary = (decoded is Map<String, dynamic> ? decoded['summary'] : null);
      if (summary is! Map<String, dynamic>) {
        throw const FormatException('Invalid analytics payload: summary missing');
      }

      return DashboardOverview(
        totalSells: _toDouble(summary['totalSells']),
        totalOrders: _toInt(summary['totalOrders']),
        totalProducts: 0,
        totalCustomers: _toInt(summary['totalCustomers']),
        dailySales: _toDouble(summary['dailySales'] ?? summary['totalSells']),
        weeklySales: _toDouble(summary['weeklySales'] ?? summary['totalSells']),
        monthlySales: _toDouble(summary['monthlySales'] ?? summary['totalSells']),
        minimumStockAllowed: _toInt(summary['minimumStockAllowed']),
        activeOrders: _toInt(summary['activeOrders'] ?? summary['totalOrders']),
        dailySalesTrendPercent: _toDouble(summary['dailySalesTrendPercent']),
        weeklySalesTrendPercent: _toDouble(summary['weeklySalesTrendPercent']),
        monthlySalesTrendPercent: _toDouble(summary['monthlySalesTrendPercent']),
        minimumStockTrendPercent: _toDouble(summary['minimumStockTrendPercent']),
        totalOrdersTrendPercent: _toDouble(summary['totalOrdersTrendPercent']),
        activeOrdersTrendPercent: _toDouble(summary['activeOrdersTrendPercent']),
      );
    } finally {
      client.close(force: true);
    }
  }

  double _toDouble(dynamic value) {
    if (value is num) return value.toDouble();
    return double.tryParse('$value') ?? 0.0;
  }

  int _toInt(dynamic value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse('$value') ?? 0;
  }
}
