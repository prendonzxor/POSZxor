import 'dart:async';

import '../domain/dashboard_overview.dart';
import 'dashboard_data_source.dart';

class DashboardLocalDataSource implements DashboardDataSource {
  @override
  Future<DashboardOverview> getOverview() async {
    await Future<void>.delayed(const Duration(milliseconds: 180));

    // Local mock data for offline mode.
    return const DashboardOverview(
      totalSells: 0.0,
      totalOrders: 0,
      totalProducts: 0,
      totalCustomers: 0,
    );
  }
}
