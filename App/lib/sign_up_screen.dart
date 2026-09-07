import 'package:flutter/material.dart';
import 'package:poszxor_app/core/ui/shad_ui.dart';
import 'package:poszxor_app/views/data_mode_setup_view.dart';

class SignUpScreen extends StatefulWidget {
  const SignUpScreen({super.key});

  @override
  State<SignUpScreen> createState() => _SignUpScreenState();
}

class _SignUpScreenState extends State<SignUpScreen> {
  void _handleRegister() {
    Navigator.of(context).pushReplacement(
      MaterialPageRoute<void>(
        builder: (_) => const DataModeSetupView(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Registro')),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: ShadCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text(
                    'Crear cuenta',
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text('Configura tu negocio en minutos', style: TextStyle(color: Color(0xFF6B7280))),
                  const SizedBox(height: 16),
                  const ShadLabel('Nombre completo'),
                  const SizedBox(height: 6),
                  const ShadInput(
                    hintText: 'Tu nombre',
                    prefixIcon: Icons.person_outline,
                  ),
                  const SizedBox(height: 12),
                  const ShadLabel('Telefono'),
                  const SizedBox(height: 6),
                  const ShadInput(
                    keyboardType: TextInputType.phone,
                    hintText: '55 0000 0000',
                    prefixIcon: Icons.phone_outlined,
                  ),
                  const SizedBox(height: 12),
                  const ShadLabel('Contrasena'),
                  const SizedBox(height: 6),
                  const ShadInput(
                    obscureText: true,
                    hintText: 'Crea una contrasena segura',
                    prefixIcon: Icons.lock_outline,
                  ),
                  const SizedBox(height: 12),
                  const ShadLabel('Confirmar contrasena'),
                  const SizedBox(height: 6),
                  const ShadInput(
                    obscureText: true,
                    hintText: 'Repite la contrasena',
                    prefixIcon: Icons.lock_person_outlined,
                  ),
                  const SizedBox(height: 16),
                  ShadPrimaryButton(
                    onPressed: _handleRegister,
                    label: 'Registrarme',
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
