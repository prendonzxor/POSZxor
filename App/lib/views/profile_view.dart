import 'package:flutter/material.dart';
import 'package:poszxor_app/core/config/data_mode.dart';
import 'package:poszxor_app/core/ui/shad_ui.dart';
import 'package:poszxor_app/sign_in_screen.dart';
import 'package:poszxor_app/sign_up_screen.dart';

class ProfileView extends StatelessWidget {
  const ProfileView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Perfil'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const ShadCard(
            child: Row(
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: Color(0xFFDBEAFE),
                  child: Icon(Icons.person_outline, size: 28, color: Color(0xFF1D4ED8)),
                ),
                SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Usuario POS ZXor',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                      ),
                      SizedBox(height: 4),
                      Text(
                        'Administrador',
                        style: TextStyle(color: Color(0xFF6B7280)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          ShadCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Datos de perfil', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                const SizedBox(height: 12),
                const _ProfileRow(label: 'Nombre', value: 'Usuario POS ZXor'),
                const SizedBox(height: 8),
                const _ProfileRow(label: 'Telefono', value: '+52 55 0000 0000'),
                const SizedBox(height: 8),
                const _ProfileRow(label: 'Correo', value: 'admin@poszxor.com'),
                const SizedBox(height: 8),
                const _ProfileRow(label: 'Sucursal', value: 'Sucursal principal'),
                const SizedBox(height: 8),
                _ProfileRow(
                  label: 'Datos',
                  value: AppDataConfig.mode == DataMode.api ? 'Fuente de datos: API' : 'Fuente de datos: Local',
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          ShadPrimaryButton(
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => const SignUpScreen(),
                ),
              );
            },
            label: 'Ir a registro',
          ),
          const SizedBox(height: 10),
          ShadSecondaryButton(
            onPressed: () {
              Navigator.of(context).pushAndRemoveUntil(
                MaterialPageRoute<void>(
                  builder: (_) => const SignInScreen(),
                ),
                (_) => false,
              );
            },
            label: 'Cerrar sesion',
          ),
        ],
      ),
    );
  }
}

class _ProfileRow extends StatelessWidget {
  const _ProfileRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        SizedBox(
          width: 90,
          child: Text(
            label,
            style: const TextStyle(
              color: Color(0xFF6B7280),
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: const TextStyle(
              color: Color(0xFF111827),
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
}
