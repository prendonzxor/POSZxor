import 'package:flutter/material.dart';
import 'package:poszxor_app/core/ui/shad_ui.dart';

class OrdersView extends StatefulWidget {
  const OrdersView({super.key});

  @override
  State<OrdersView> createState() => _OrdersViewState();
}

class _OrdersViewState extends State<OrdersView> {
  final List<_OrderItem> _orders = const [
    _OrderItem(id: 'ord-1024', numOrder: 'ORD-1024', customer: 'Cliente mostrador', total: 980.0, status: 'paid', date: '2026-03-05'),
    _OrderItem(id: 'ord-1023', numOrder: 'ORD-1023', customer: 'Maria Gomez', total: 420.5, status: 'created', date: '2026-03-05'),
    _OrderItem(id: 'ord-1022', numOrder: 'ORD-1022', customer: 'Taller Rivera', total: 1500.0, status: 'cancelled', date: '2026-03-04'),
  ];

  String _search = '';
  String _status = 'all';

  List<_OrderItem> get _filtered {
    final query = _search.trim().toLowerCase();
    return _orders.where((order) {
      final statusMatch = _status == 'all' ? true : order.status == _status;
      if (!statusMatch) return false;
      if (query.isEmpty) return true;
      return order.numOrder.toLowerCase().contains(query) || order.customer.toLowerCase().contains(query);
    }).toList();
  }

  int get _paidCount => _filtered.where((o) => o.status == 'paid').length;
  int get _pendingCount => _filtered.where((o) => o.status == 'created').length;
  double get _totalAmount => _filtered.fold<double>(0, (sum, item) => sum + item.total);

  Color _statusBg(String status) {
    if (status == 'paid') return const Color(0xFFDCFCE7);
    if (status == 'created') return const Color(0xFFFEF3C7);
    return const Color(0xFFFEE2E2);
  }

  Color _statusFg(String status) {
    if (status == 'paid') return const Color(0xFF166534);
    if (status == 'created') return const Color(0xFF92400E);
    return const Color(0xFF991B1B);
  }

  String _statusLabel(String status) {
    if (status == 'paid') return 'Pagada';
    if (status == 'created') return 'Pendiente';
    if (status == 'cancelled') return 'Cancelada';
    return status;
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const ShadCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Ordenes', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
              SizedBox(height: 4),
              Text('Consulta el historial y estado de cobro en una sola vista.'),
            ],
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          decoration: const InputDecoration(
            hintText: 'Buscar por numero o cliente',
            prefixIcon: Icon(Icons.search),
          ),
          onChanged: (value) => setState(() => _search = value),
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            ChoiceChip(
              label: const Text('Todos'),
              selected: _status == 'all',
              onSelected: (_) => setState(() => _status = 'all'),
            ),
            ChoiceChip(
              label: const Text('Pagadas'),
              selected: _status == 'paid',
              onSelected: (_) => setState(() => _status = 'paid'),
            ),
            ChoiceChip(
              label: const Text('Pendientes'),
              selected: _status == 'created',
              onSelected: (_) => setState(() => _status = 'created'),
            ),
            ChoiceChip(
              label: const Text('Canceladas'),
              selected: _status == 'cancelled',
              onSelected: (_) => setState(() => _status = 'cancelled'),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(child: _SummaryCard(title: 'Ordenes', value: '${_filtered.length}')),
            const SizedBox(width: 8),
            Expanded(child: _SummaryCard(title: 'Pagadas', value: '$_paidCount')),
            const SizedBox(width: 8),
            Expanded(child: _SummaryCard(title: 'Pendientes', value: '$_pendingCount')),
          ],
        ),
        const SizedBox(height: 10),
        _SummaryCard(title: 'Total filtrado', value: '\$${_totalAmount.toStringAsFixed(2)}', wide: true),
        const SizedBox(height: 12),
        ShadCard(
          padding: EdgeInsets.zero,
          child: _filtered.isEmpty
              ? const Padding(
                  padding: EdgeInsets.all(20),
                  child: Column(
                    children: [
                      Icon(Icons.receipt_long_outlined, size: 40, color: Color(0xFF9CA3AF)),
                      SizedBox(height: 8),
                      Text('No hay ordenes para mostrar', style: TextStyle(color: Color(0xFF6B7280))),
                    ],
                  ),
                )
              : ListView.separated(
                  physics: const NeverScrollableScrollPhysics(),
                  shrinkWrap: true,
                  itemCount: _filtered.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final order = _filtered[index];
                    return ListTile(
                      leading: const Icon(Icons.receipt_long_outlined),
                      title: Text(order.numOrder, style: const TextStyle(fontWeight: FontWeight.w700)),
                      subtitle: Text('${order.customer}\n${order.date}'),
                      isThreeLine: true,
                      trailing: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text('\$${order.total.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w700)),
                          const SizedBox(height: 4),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: _statusBg(order.status),
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              _statusLabel(order.status),
                              style: TextStyle(fontSize: 11, color: _statusFg(order.status), fontWeight: FontWeight.w600),
                            ),
                          ),
                        ],
                      ),
                      onTap: () {
                        showModalBottomSheet<void>(
                          context: context,
                          showDragHandle: true,
                          builder: (_) => Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(order.numOrder, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
                                const SizedBox(height: 8),
                                Text('Cliente: ${order.customer}'),
                                Text('Fecha: ${order.date}'),
                                Text('Estado: ${_statusLabel(order.status)}'),
                                Text('Total: \$${order.total.toStringAsFixed(2)}'),
                                const SizedBox(height: 12),
                                const Text('Detalle completo disponible en integracion con API.'),
                              ],
                            ),
                          ),
                        );
                      },
                    );
                  },
                ),
        ),
      ],
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.title, required this.value, this.wide = false});
  final String title;
  final String value;
  final bool wide;

  @override
  Widget build(BuildContext context) {
    return ShadCard(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontSize: 12, color: Colors.black54)),
          const SizedBox(height: 4),
          Text(
            value.trim(),
            style: TextStyle(fontSize: wide ? 24 : 20, fontWeight: FontWeight.w800),
          ),
        ],
      ),
    );
  }
}

class _OrderItem {
  const _OrderItem({
    required this.id,
    required this.numOrder,
    required this.customer,
    required this.total,
    required this.status,
    required this.date,
  });

  final String id;
  final String numOrder;
  final String customer;
  final double total;
  final String status;
  final String date;
}
