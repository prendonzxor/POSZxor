import 'package:flutter/material.dart';
import 'package:poszxor_app/core/ui/shad_ui.dart';

class InventoryView extends StatelessWidget {
  const InventoryView({super.key});

  @override
  Widget build(BuildContext context) {
    final isCompact = MediaQuery.sizeOf(context).width < 720;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('Inventario', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        const Text('Controla existencias por sucursal y reorden.', style: TextStyle(color: Color(0xFF6B7280))),
        const SizedBox(height: 12),
        GridView.count(
          physics: const NeverScrollableScrollPhysics(),
          shrinkWrap: true,
          crossAxisCount: isCompact ? 2 : 4,
          crossAxisSpacing: 10,
          mainAxisSpacing: 10,
          childAspectRatio: isCompact ? 1.35 : 1.8,
          children: const [
            _InfoBox(title: 'Existencia total', value: '0'),
            _InfoBox(title: 'Reservado', value: '0'),
            _InfoBox(title: 'Disponible', value: '0'),
            _InfoBox(title: 'Movimientos hoy', value: '0'),
          ],
        ),
        const SizedBox(height: 12),
        ShadCard(
          child: ListTile(
            title: const Text('Formulario de inventario'),
            subtitle: const Text('Ajusta cantidades por sucursal y producto'),
            trailing: ShadPrimaryButton(onPressed: () {}, label: 'Agregar'),
          ),
        ),
        const SizedBox(height: 12),
        ShadCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: const [
              ListTile(
                leading: Icon(Icons.list_alt_outlined),
                title: Text('Existencias por sucursal'),
                subtitle: Text('No hay registros disponibles todavia'),
              ),
              Divider(height: 1),
              Padding(
                padding: EdgeInsets.all(16),
                child: Column(
                  children: [
                    Icon(Icons.inventory_2_outlined, size: 40, color: Color(0xFF9CA3AF)),
                    SizedBox(height: 8),
                    Text('Cuando registres inventario aparecera aqui', style: TextStyle(color: Color(0xFF6B7280))),
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

class _InfoBox extends StatelessWidget {
  const _InfoBox({required this.title, required this.value});
  final String title;
  final String value;

  @override
  Widget build(BuildContext context) {
    return ShadCard(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontSize: 12, color: Colors.black54)),
          const SizedBox(height: 6),
          Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}
