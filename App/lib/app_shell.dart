import 'package:flutter/material.dart';
import 'package:poszxor_app/views/admin_view.dart';
import 'package:poszxor_app/views/customers_view.dart';
import 'package:poszxor_app/views/dashboard_view.dart';
import 'package:poszxor_app/views/inventory_view.dart';
import 'package:poszxor_app/views/orders_view.dart';
import 'package:poszxor_app/views/pos_view.dart';
import 'package:poszxor_app/views/profile_view.dart';
import 'package:poszxor_app/views/products_services_view.dart';

class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  final _scaffoldKey = GlobalKey<ScaffoldState>();
  int _index = 0;

  static const _labels = <String>[
    'Dashboard',
    'POS',
    'Productos',
    'Inventario',
    'Clientes',
    'Ordenes',
    'Admin',
  ];

  static const _subtitles = <String>[
    'Resumen del negocio',
    'Caja rapida y ordenes',
    'Catalogo de productos y servicios',
    'Control de existencias',
    'Gestion de clientes',
    'Ventas y seguimiento',
    'Configuracion general',
  ];

  static const _icons = <IconData>[
    Icons.dashboard_outlined,
    Icons.point_of_sale_outlined,
    Icons.inventory_2_outlined,
    Icons.warehouse_outlined,
    Icons.people_outline,
    Icons.receipt_long_outlined,
    Icons.admin_panel_settings_outlined,
  ];

  final _views = const <Widget>[
    DashboardView(),
    PosView(),
    ProductsServicesView(),
    InventoryView(),
    CustomersView(),
    OrdersView(),
    AdminView(),
  ];

  void _selectView(int value, {bool closeDrawer = false}) {
    setState(() => _index = value);
    if (closeDrawer) {
      Navigator.of(context).pop();
    }
  }

  Widget _buildNavigationRail() {
    return NavigationRail(
      selectedIndex: _index,
      onDestinationSelected: _selectView,
      labelType: NavigationRailLabelType.all,
      destinations: List.generate(
        _labels.length,
        (i) => NavigationRailDestination(
          icon: Icon(_icons[i]),
          label: Text(_labels[i]),
        ),
      ),
    );
  }

  Widget _buildNavigationDrawer() {
    return Drawer(
      child: SafeArea(
        child: Column(
          children: [
            const ListTile(
              title: Text('POS ZXor', style: TextStyle(fontWeight: FontWeight.w800)),
              subtitle: Text('Selecciona una vista'),
            ),
            const Divider(height: 1),
            Expanded(
              child: ListView.builder(
                itemCount: _labels.length,
                itemBuilder: (context, i) {
                  final selected = i == _index;
                  return ListTile(
                    leading: Icon(_icons[i], color: selected ? const Color(0xFF2563EB) : null),
                    title: Text(
                      _labels[i],
                      style: TextStyle(
                        color: selected ? const Color(0xFF1D4ED8) : null,
                        fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                      ),
                    ),
                    subtitle: Text(_subtitles[i]),
                    selected: selected,
                    selectedTileColor: const Color(0xFFEFF6FF),
                    onTap: () => _selectView(i, closeDrawer: true),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isCompact = MediaQuery.sizeOf(context).width < 768;

    return Scaffold(
      key: _scaffoldKey,
      appBar: AppBar(
        leading: isCompact
            ? IconButton(
                tooltip: 'Abrir menu',
                onPressed: () {
                  final scaffoldState = _scaffoldKey.currentState;
                  if (scaffoldState == null) return;
                  if (scaffoldState.isDrawerOpen) {
                    Navigator.of(context).pop();
                  } else {
                    scaffoldState.openDrawer();
                  }
                },
                icon: const Icon(Icons.menu_rounded),
              )
            : null,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(_labels[_index], style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
            Text(_subtitles[_index], style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
          ],
        ),
        toolbarHeight: 68,
        actions: [
          IconButton(onPressed: () {}, icon: const Icon(Icons.notifications_none_rounded)),
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: InkWell(
              borderRadius: BorderRadius.circular(24),
              onTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => const ProfileView(),
                  ),
                );
              },
              child: const CircleAvatar(
                radius: 16,
                backgroundColor: Color(0xFFDBEAFE),
                child: Icon(Icons.person_outline, size: 18, color: Color(0xFF1D4ED8)),
              ),
            ),
          ),
        ],
      ),
      drawer: isCompact ? _buildNavigationDrawer() : null,
      body: Row(
        children: [
          if (!isCompact) _buildNavigationRail(),
          Expanded(
            child: SafeArea(
              top: false,
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 220),
                child: KeyedSubtree(key: ValueKey(_index), child: _views[_index]),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
