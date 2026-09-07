import 'package:flutter/material.dart';
import 'package:poszxor_app/core/ui/shad_ui.dart';

class SubscriptionPaymentView extends StatefulWidget {
  const SubscriptionPaymentView({
    super.key,
    required this.planName,
    required this.amountLabel,
  });

  final String planName;
  final String amountLabel;

  @override
  State<SubscriptionPaymentView> createState() => _SubscriptionPaymentViewState();
}

class _SubscriptionPaymentViewState extends State<SubscriptionPaymentView> {
  bool _isProcessing = false;

  Future<void> _handlePay() async {
    setState(() => _isProcessing = true);
    await Future<void>.delayed(const Duration(milliseconds: 900));
    if (!mounted) return;
    Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Pago de suscripcion')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          ShadCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Plan: ${widget.planName}',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 4),
                Text(
                  'Monto: ${widget.amountLabel}',
                  style: const TextStyle(color: Color(0xFF6B7280)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          const ShadCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ShadLabel('Nombre del titular'),
                SizedBox(height: 6),
                ShadInput(
                  hintText: 'Como aparece en la tarjeta',
                  prefixIcon: Icons.person_outline,
                ),
                SizedBox(height: 12),
                ShadLabel('Numero de tarjeta'),
                SizedBox(height: 6),
                ShadInput(
                  hintText: '1234 5678 9012 3456',
                  prefixIcon: Icons.credit_card_outlined,
                  keyboardType: TextInputType.number,
                ),
                SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          ShadLabel('Expiracion'),
                          SizedBox(height: 6),
                          ShadInput(
                            hintText: 'MM/AA',
                            keyboardType: TextInputType.number,
                          ),
                        ],
                      ),
                    ),
                    SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          ShadLabel('CVV'),
                          SizedBox(height: 6),
                          ShadInput(
                            hintText: '123',
                            keyboardType: TextInputType.number,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          ShadPrimaryButton(
            onPressed: _isProcessing ? null : _handlePay,
            label: _isProcessing ? 'Procesando pago...' : 'Pagar y continuar',
          ),
          const SizedBox(height: 10),
          ShadSecondaryButton(
            onPressed: _isProcessing ? null : () => Navigator.of(context).pop(false),
            label: 'Cancelar',
          ),
        ],
      ),
    );
  }
}
