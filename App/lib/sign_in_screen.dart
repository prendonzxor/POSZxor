import 'package:flutter/material.dart';
import 'package:poszxor_app/app_shell.dart';
import 'package:poszxor_app/core/ui/shad_ui.dart';
import 'package:poszxor_app/sign_up_screen.dart';

class SignInScreen extends StatefulWidget {
  const SignInScreen({super.key});

  @override
  State<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends State<SignInScreen> {
  void _handleEnter() {
    Navigator.of(context).pushReplacement(
      MaterialPageRoute<void>(
        builder: (_) => const AppShell(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFFEFF6FF), Color(0xFFF8FAFC)],
          ),
        ),
        child: Center(
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
                      'Bienvenido a POS ZXor',
                      style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Ingresa para continuar',
                      style: TextStyle(color: Color(0xFF6B7280)),
                    ),
                    const SizedBox(height: 16),
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
                      hintText: 'Ingresa tu contrasena',
                      prefixIcon: Icons.lock_outline,
                    ),
                    const SizedBox(height: 16),
                    ShadPrimaryButton(
                      onPressed: _handleEnter,
                      label: 'Entrar',
                    ),
                    const SizedBox(height: 10),
                    ShadSecondaryButton(
                      onPressed: () {
                        Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            builder: (_) => const SignUpScreen(),
                          ),
                        );
                      },
                      label: 'Crear cuenta',
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
