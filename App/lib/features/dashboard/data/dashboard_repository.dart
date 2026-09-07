import '../../../core/config/data_mode.dart';
import '../domain/dashboard_overview.dart';
import 'dashboard_api_data_source.dart';
import 'dashboard_data_source.dart';
import 'dashboard_local_data_source.dart';

class DashboardRepository {
  DashboardRepository({
    DashboardDataSource? localDataSource,
    DashboardDataSource? apiDataSource,
  })  : _localDataSource = localDataSource ?? DashboardLocalDataSource(),
        _apiDataSource = apiDataSource ?? const DashboardApiDataSource();

  final DashboardDataSource _localDataSource;
  final DashboardDataSource _apiDataSource;

  Future<DashboardOverview> getOverview() async {
    if (AppDataConfig.mode == DataMode.local) {
      return _localDataSource.getOverview();
    }

    // In API mode we fallback to local to keep app usable offline/errors.
    try {
      return await _apiDataSource.getOverview();
    } catch (_) {
      return _localDataSource.getOverview();
    }
  }
}
