import '../domain/dashboard_overview.dart';

abstract class DashboardDataSource {
  Future<DashboardOverview> getOverview();
}
