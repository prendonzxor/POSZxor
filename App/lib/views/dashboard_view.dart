import 'package:flutter/material.dart';
import 'package:poszxor_app/core/ui/shad_ui.dart';
import 'package:poszxor_app/features/dashboard/data/dashboard_repository.dart';
import 'package:poszxor_app/features/dashboard/domain/dashboard_overview.dart';

class DashboardView extends StatefulWidget {
  const DashboardView({super.key});

  @override
  State<DashboardView> createState() => _DashboardViewState();
}

class _DashboardViewState extends State<DashboardView> {
  late final DashboardRepository _dashboardRepository;
  late Future<DashboardOverview> _overviewFuture;

  @override
  void initState() {
    super.initState();
    _dashboardRepository = DashboardRepository();
    _overviewFuture = _dashboardRepository.getOverview();
  }

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final crossAxisCount = width < 700 ? 2 : 4;
    final ratio = width < 700 ? 1.25 : 1.75;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const ShadCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Resumen del negocio', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
              SizedBox(height: 4),
              Text('Vista general de ventas, inventario y operaciones del dia.'),
            ],
          ),
        ),
        const SizedBox(height: 16),
        FutureBuilder<DashboardOverview>(
          future: _overviewFuture,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: Padding(padding: EdgeInsets.all(20), child: CircularProgressIndicator()));
            }

            if (snapshot.hasError) {
              return ShadCard(
                child: Text(
                  'No se pudieron cargar metricas. ${snapshot.error}',
                  style: const TextStyle(color: Color(0xFFB91C1C)),
                ),
              );
            }

            final overview = snapshot.data ??
                const DashboardOverview(
                  totalSells: 0.0,
                  totalOrders: 0,
                  totalProducts: 0,
                  totalCustomers: 0,
                );
            final dailySales = overview.dailySales ?? overview.totalSells;
            final weeklySales = overview.weeklySales ?? overview.totalSells;
            final monthlySales = overview.monthlySales ?? overview.totalSells;
            final activeOrders = overview.activeOrders ?? overview.totalOrders;

            return GridView.count(
              physics: const NeverScrollableScrollPhysics(),
              shrinkWrap: true,
              crossAxisCount: crossAxisCount,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              childAspectRatio: ratio,
              children: [
                _MetricCard(
                  title: 'Ventas dia',
                  value: '\$${dailySales.toStringAsFixed(2)}',
                  icon: Icons.today_outlined,
                  trendPercent: overview.dailySalesTrendPercent,
                ),
                _MetricCard(
                  title: 'Ventas semanales',
                  value: '\$${weeklySales.toStringAsFixed(2)}',
                  icon: Icons.calendar_view_week_outlined,
                  trendPercent: overview.weeklySalesTrendPercent,
                ),
                _MetricCard(
                  title: 'Ventas mensuales',
                  value: '\$${monthlySales.toStringAsFixed(2)}',
                  icon: Icons.calendar_month_outlined,
                  trendPercent: overview.monthlySalesTrendPercent,
                ),
                _MetricCard(
                  title: 'Stock minimo permitido',
                  value: '${overview.minimumStockAllowed}',
                  icon: Icons.warning_amber_outlined,
                  trendPercent: overview.minimumStockTrendPercent,
                  isLowerBetter: true,
                ),
                _MetricCard(
                  title: 'Ordenes totales',
                  value: '${overview.totalOrders}',
                  icon: Icons.receipt_long_outlined,
                  trendPercent: overview.totalOrdersTrendPercent,
                ),
                _MetricCard(
                  title: 'Ordenes activas',
                  value: '$activeOrders',
                  icon: Icons.pending_actions_outlined,
                  trendPercent: overview.activeOrdersTrendPercent,
                ),
              ],
            );
          },
        ),
      ],
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.title,
    required this.value,
    required this.icon,
    required this.trendPercent,
    this.isLowerBetter = false,
  });

  final String title;
  final String value;
  final IconData icon;
  final double trendPercent;
  final bool isLowerBetter;

  @override
  Widget build(BuildContext context) {
    final trendIsPositive = trendPercent >= 0;
    final trendIsGood = isLowerBetter ? !trendIsPositive : trendIsPositive;
    final trendColor = trendIsGood ? const Color(0xFF16A34A) : const Color(0xFFDC2626);
    final trendBackground = trendIsGood ? const Color(0xFFDCFCE7) : const Color(0xFFFEE2E2);
    final trendIcon = trendIsPositive ? Icons.arrow_upward_rounded : Icons.arrow_downward_rounded;

    return ShadCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6FF),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: const Color(0xFF2563EB), size: 19),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12, color: Colors.black54, fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Text(
                  value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
                decoration: BoxDecoration(
                  color: trendBackground,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(trendIcon, size: 13, color: trendColor),
                    const SizedBox(width: 2),
                    Text(
                      '${trendPercent.abs().toStringAsFixed(1)}%',
                      style: TextStyle(fontSize: 11, color: trendColor, fontWeight: FontWeight.w700),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          const Text(
            'vs periodo anterior',
            style: TextStyle(fontSize: 10, color: Color(0xFF6B7280)),
          ),
        ],
      ),
    );
  }
}
