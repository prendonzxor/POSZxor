class DashboardOverview {
  const DashboardOverview({
    required this.totalSells,
    required this.totalOrders,
    required this.totalProducts,
    required this.totalCustomers,
    this.dailySales,
    this.weeklySales,
    this.monthlySales,
    this.minimumStockAllowed = 0,
    this.activeOrders,
    this.dailySalesTrendPercent = 0.0,
    this.weeklySalesTrendPercent = 0.0,
    this.monthlySalesTrendPercent = 0.0,
    this.minimumStockTrendPercent = 0.0,
    this.totalOrdersTrendPercent = 0.0,
    this.activeOrdersTrendPercent = 0.0,
  });

  final double totalSells;
  final int totalOrders;
  final int totalProducts;
  final int totalCustomers;
  final double? dailySales;
  final double? weeklySales;
  final double? monthlySales;
  final int minimumStockAllowed;
  final int? activeOrders;
  final double dailySalesTrendPercent;
  final double weeklySalesTrendPercent;
  final double monthlySalesTrendPercent;
  final double minimumStockTrendPercent;
  final double totalOrdersTrendPercent;
  final double activeOrdersTrendPercent;
}
