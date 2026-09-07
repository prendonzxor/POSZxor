import 'package:flutter/material.dart';
import 'package:poszxor_app/core/ui/shad_ui.dart';

class PosView extends StatefulWidget {
  const PosView({super.key});

  @override
  State<PosView> createState() => _PosViewState();
}

class _PosViewState extends State<PosView> {
  final List<_PosItem> _items = [];

  void _addMockItem() {
    setState(() {
      _items.add(const _PosItem(name: 'Producto demo', qty: 1, unitPrice: 99.0));
    });
  }

  @override
  Widget build(BuildContext context) {
    final total = _items.fold<double>(0, (sum, item) => sum + item.qty * item.unitPrice);
    final isCompact = MediaQuery.sizeOf(context).width < 720;

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('POS / Ordenes', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          const Text('Busca clientes, agrega productos y cobra en segundos.', style: TextStyle(color: Color(0xFF6B7280))),
          const SizedBox(height: 12),
          if (isCompact)
            Column(
              children: [
                const ShadInput(
                  hintText: 'Buscar cliente',
                  prefixIcon: Icons.person_search_outlined,
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  decoration: const InputDecoration(
                    labelText: 'Tipo de orden',
                  ),
                  items: const [
                    DropdownMenuItem(value: 'pos', child: Text('POS')),
                    DropdownMenuItem(value: 'delivery', child: Text('Envio')),
                    DropdownMenuItem(value: 'pickup', child: Text('Recogida')),
                  ],
                  onChanged: (_) {},
                ),
              ],
            )
          else
            Row(
              children: [
                const Expanded(
                  child: ShadInput(
                    hintText: 'Buscar cliente',
                    prefixIcon: Icons.person_search_outlined,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    decoration: const InputDecoration(labelText: 'Tipo de orden'),
                    items: const [
                      DropdownMenuItem(value: 'pos', child: Text('POS')),
                      DropdownMenuItem(value: 'delivery', child: Text('Envio')),
                      DropdownMenuItem(value: 'pickup', child: Text('Recogida')),
                    ],
                    onChanged: (_) {},
                  ),
                ),
              ],
            ),
          const SizedBox(height: 12),
          if (isCompact)
            Column(
              children: [
                const ShadInput(
                  hintText: 'Buscar producto por nombre / SKU / barcode',
                  prefixIcon: Icons.search,
                ),
                const SizedBox(height: 10),
                SizedBox(
                  width: double.infinity,
                  child: ShadPrimaryButton(
                    onPressed: _addMockItem,
                    label: 'Agregar al carrito',
                  ),
                ),
              ],
            )
          else
            Row(
              children: [
                const Expanded(
                  child: ShadInput(
                    hintText: 'Buscar producto por nombre / SKU / barcode',
                    prefixIcon: Icons.search,
                  ),
                ),
                const SizedBox(width: 12),
                ShadPrimaryButton(onPressed: _addMockItem, label: 'Agregar'),
              ],
            ),
          const SizedBox(height: 16),
          Expanded(
            child: ShadCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  const ListTile(
                    title: Text('Carrito'),
                    subtitle: Text('Productos y servicios agregados'),
                    leading: Icon(Icons.shopping_cart_outlined),
                  ),
                  const Divider(height: 1),
                  Expanded(
                    child: _items.isEmpty
                        ? const Center(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.shopping_cart_outlined, size: 42, color: Color(0xFF9CA3AF)),
                                SizedBox(height: 8),
                                Text('Agrega un producto para comenzar', style: TextStyle(color: Color(0xFF6B7280))),
                              ],
                            ),
                          )
                        : ListView.separated(
                            itemCount: _items.length,
                            separatorBuilder: (_, index) => const Divider(height: 1),
                            itemBuilder: (_, index) {
                              final item = _items[index];
                              final subtotal = item.qty * item.unitPrice;
                              return ListTile(
                                title: Text(item.name),
                                subtitle: Text('Cant: ${item.qty}  |  Precio: \$${item.unitPrice.toStringAsFixed(2)}'),
                                trailing: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text('\$${subtotal.toStringAsFixed(2)}'),
                                    IconButton(
                                      onPressed: () => setState(() => _items.removeAt(index)),
                                      icon: const Icon(Icons.delete_outline, color: Color(0xFFDC2626)),
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                  ),
                  const Divider(height: 1),
                  Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        ShadSecondaryButton(
                          onPressed: _items.isEmpty ? null : () => setState(_items.clear),
                          label: 'Vaciar',
                        ),
                        Text(
                          'Total: \$${total.toStringAsFixed(2)}',
                          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PosItem {
  const _PosItem({required this.name, required this.qty, required this.unitPrice});
  final String name;
  final int qty;
  final double unitPrice;
}
