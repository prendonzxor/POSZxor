import 'package:flutter/material.dart';
import 'package:poszxor_app/core/ui/shad_ui.dart';

class ProductsServicesView extends StatelessWidget {
  const ProductsServicesView({super.key});

  @override
  Widget build(BuildContext context) {
    final isCompact = MediaQuery.sizeOf(context).width < 720;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            const Expanded(
              child: Text('Productos y servicios', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
            ),
            ShadPrimaryButton(onPressed: () {}, label: 'Nuevo'),
          ],
        ),
        const SizedBox(height: 6),
        const Text('Administra tu catalogo y precios de venta.', style: TextStyle(color: Color(0xFF6B7280))),
        const SizedBox(height: 12),
        isCompact
            ? Column(
                children: [
                  const ShadInput(
                    hintText: 'Buscar por nombre, SKU o barcode',
                    prefixIcon: Icons.search,
                  ),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    decoration: const InputDecoration(labelText: 'Tipo'),
                    items: const [
                      DropdownMenuItem(value: 'all', child: Text('Todos')),
                      DropdownMenuItem(value: 'product', child: Text('Producto')),
                      DropdownMenuItem(value: 'service', child: Text('Servicio')),
                    ],
                    onChanged: (_) {},
                  ),
                ],
              )
            : Row(
                children: [
                  Expanded(
                    child: const ShadInput(
                      hintText: 'Buscar por nombre, SKU o barcode',
                      prefixIcon: Icons.search,
                    ),
                  ),
                  const SizedBox(width: 12),
                  SizedBox(
                    width: 180,
                    child: DropdownButtonFormField<String>(
                      decoration: const InputDecoration(labelText: 'Tipo'),
                      items: const [
                        DropdownMenuItem(value: 'all', child: Text('Todos')),
                        DropdownMenuItem(value: 'product', child: Text('Producto')),
                        DropdownMenuItem(value: 'service', child: Text('Servicio')),
                      ],
                      onChanged: (_) {},
                    ),
                  ),
                ],
              ),
        const SizedBox(height: 12),
        ShadCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: const [
              ListTile(
                leading: Icon(Icons.inventory_2_outlined),
                title: Text('Catalogo'),
                subtitle: Text('No hay productos cargados todavia'),
              ),
              Divider(height: 1),
              Padding(
                padding: EdgeInsets.all(16),
                child: Column(
                  children: [
                    Icon(Icons.shopping_bag_outlined, size: 40, color: Color(0xFF9CA3AF)),
                    SizedBox(height: 8),
                    Text('Crea tu primer producto para comenzar', style: TextStyle(color: Color(0xFF6B7280))),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
