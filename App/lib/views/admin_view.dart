import 'package:flutter/material.dart';
import 'package:poszxor_app/core/ui/shad_ui.dart';

class AdminView extends StatelessWidget {
  const AdminView({super.key});

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final crossAxisCount = width < 700 ? 1 : 2;
    final aspect = width < 700 ? 2.8 : 2.0;

    final cards = <({String title, String subtitle, IconData icon})>[
      (title: 'Tenants', subtitle: 'Gestion de datos del negocio', icon: Icons.apartment_outlined),
      (title: 'Sucursales', subtitle: 'Alta y edicion de tiendas', icon: Icons.store_outlined),
      (title: 'Categorias', subtitle: 'Clasificacion de productos', icon: Icons.category_outlined),
      (title: 'Roles', subtitle: 'Permisos y accesos', icon: Icons.badge_outlined),
      (title: 'Usuarios', subtitle: 'Usuarios del sistema', icon: Icons.groups_outlined),
    ];

    return GridView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: cards.length,
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: crossAxisCount,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
        childAspectRatio: aspect,
      ),
      itemBuilder: (_, index) {
        final card = cards[index];
        return ShadCard(
          padding: EdgeInsets.zero,
          child: InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: () {},
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                children: [
                  CircleAvatar(
                    backgroundColor: const Color(0xFFEEF2FF),
                    child: Icon(card.icon, color: const Color(0xFF4338CA)),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(card.title, style: const TextStyle(fontWeight: FontWeight.w700)),
                        const SizedBox(height: 2),
                        Text(card.subtitle, style: const TextStyle(fontSize: 12, color: Colors.black54)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
