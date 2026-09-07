import 'package:flutter/material.dart';
import 'package:poszxor_app/core/ui/shad_ui.dart';

class CustomersView extends StatelessWidget {
  const CustomersView({super.key});

  @override
  Widget build(BuildContext context) {
    final isCompact = MediaQuery.sizeOf(context).width < 720;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            const Expanded(
              child: Text('Clientes', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
            ),
            ShadPrimaryButton(onPressed: () {}, label: 'Nuevo'),
          ],
        ),
        const SizedBox(height: 6),
        const Text('Busca y administra clientes frecuentes y credito.', style: TextStyle(color: Color(0xFF6B7280))),
        const SizedBox(height: 12),
        const ShadInput(
          hintText: 'Buscar por nombre, telefono o correo',
          prefixIcon: Icons.search,
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            FilterChip(label: const Text('Activos'), selected: true, onSelected: (_) {}),
            FilterChip(label: const Text('Con credito'), selected: false, onSelected: (_) {}),
            FilterChip(label: const Text('Recientes'), selected: false, onSelected: (_) {}),
          ],
        ),
        const SizedBox(height: 12),
        ShadCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              const ListTile(
                leading: Icon(Icons.people_outline),
                title: Text('Listado de clientes'),
                subtitle: Text('No hay clientes para mostrar'),
              ),
              const Divider(height: 1),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    const Icon(Icons.person_search_outlined, size: 40, color: Color(0xFF9CA3AF)),
                    const SizedBox(height: 8),
                    const Text('Aun no hay resultados disponibles', style: TextStyle(color: Color(0xFF6B7280))),
                    if (isCompact) const SizedBox(height: 4),
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
