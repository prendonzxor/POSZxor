import 'package:flutter/material.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final isMobile = width < 600;
    final isTablet = width >= 600 && width < 1024;
    final appBarTitleSize = isMobile ? 18.0 : isTablet ? 20.0 : 24.0;
    final heroTitleSize = isMobile ? 20.0 : isTablet ? 24.0 : 28.0;
    final heroSubtitleSize = isMobile ? 13.0 : isTablet ? 14.0 : 16.0;
    final cardTitleSize = isMobile ? 14.0 : isTablet ? 16.0 : 18.0;

    final menuItems = [
      ('Dashboard', Icons.dashboard_outlined),
      ('Productos', Icons.inventory_2_outlined),
      ('Inventario', Icons.warehouse_outlined),
      ('POS', Icons.point_of_sale_outlined),
      ('Ordenes', Icons.receipt_long_outlined),
      ('Clientes', Icons.people_outline),
      ('Administracion', Icons.admin_panel_settings_outlined),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'POS Zxor',
          style: TextStyle(fontSize: appBarTitleSize, fontWeight: FontWeight.w700),
        ),
        centerTitle: false,
        actions: [
          IconButton(
            onPressed: () {},
            tooltip: 'Notificaciones',
            icon: const Icon(Icons.notifications_none_rounded),
          ),
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: InkWell(
              borderRadius: BorderRadius.circular(20),
              onTap: () {},
              child: const CircleAvatar(
                radius: 16,
                backgroundColor: Color(0xFFDBEAFE),
                child: Icon(
                  Icons.person_outline,
                  size: 18,
                  color: Color(0xFF1D4ED8),
                ),
              ),
            ),
          ),
        ],
      ),
      body: LayoutBuilder(
        builder: (context, constraints) {
          return Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    gradient: const LinearGradient(
                      colors: [Color(0xFFEEF4FF), Color(0xFFE0EAFF)],
                    ),
                    border: Border.all(color: const Color(0xFFDBEAFE)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Menu principal',
                        style: TextStyle(
                          fontSize: heroTitleSize,
                          fontWeight: FontWeight.w700,
                          color: const Color(0xFF1E3A8A),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Accede rapido a los modulos principales del sistema.',
                        style: TextStyle(
                          fontSize: heroSubtitleSize,
                          color: const Color(0xFF475569),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                Expanded(
                  child: GridView.builder(
                    itemCount: menuItems.length,
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      crossAxisSpacing: 12,
                      mainAxisSpacing: 12,
                      childAspectRatio: 1.55,
                    ),
                    itemBuilder: (context, index) {
                      final (title, icon) = menuItems[index];
                      return Material(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(14),
                          onTap: () {},
                          child: Ink(
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: const Color(0xFFE5E7EB)),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                              child: Row(
                                children: [
                                  Container(
                                    width: 38,
                                    height: 38,
                                    decoration: const BoxDecoration(
                                      color: Color(0xFFEEF2FF),
                                      shape: BoxShape.circle,
                                    ),
                                    child: Icon(icon, color: const Color(0xFF3730A3), size: 20),
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Column(
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          title,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(
                                            fontSize: cardTitleSize,
                                            fontWeight: FontWeight.w600,
                                            color: const Color(0xFF111827),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  const Icon(Icons.chevron_right_rounded, color: Color(0xFF9CA3AF)),
                                ],
                              ),
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
