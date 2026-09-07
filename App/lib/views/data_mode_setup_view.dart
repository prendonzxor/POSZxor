import 'package:flutter/material.dart';
import 'package:poszxor_app/core/config/data_mode.dart';
import 'package:poszxor_app/core/ui/shad_ui.dart';
import 'package:poszxor_app/views/onboarding_fullscreen_view.dart';
import 'package:poszxor_app/views/subscription_payment_view.dart';

class DataModeSetupView extends StatefulWidget {
  const DataModeSetupView({super.key});

  @override
  State<DataModeSetupView> createState() => _DataModeSetupViewState();
}

class _DataModeSetupViewState extends State<DataModeSetupView> {
  DataMode _selected = DataMode.api;
  ApiPlan _selectedApiPlan = ApiPlan.free;
  LocalPlan _selectedLocalPlan = LocalPlan.free;
  final TextEditingController _apiBaseUrlController = TextEditingController(
    text: AppDataConfig.apiBaseUrl,
  );
  bool _isSaving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final mode = DataModeController.instance.selectedMode;
    if (mode != null) {
      _selected = mode;
    }
  }

  @override
  void dispose() {
    _apiBaseUrlController.dispose();
    super.dispose();
  }

  Future<void> _handleContinue() async {
    if (_selected == DataMode.api && _apiBaseUrlController.text.trim().isEmpty) {
      setState(() {
        _error = 'Ingresa una URL base para API.';
      });
      return;
    }

    final paymentMeta = _getPaymentRequiredMeta();
    if (paymentMeta != null) {
      final result = await Navigator.of(context).push<bool>(
        MaterialPageRoute<bool>(
          builder: (_) => SubscriptionPaymentView(
            planName: paymentMeta.planName,
            amountLabel: paymentMeta.amountLabel,
          ),
        ),
      );

      if (result != true) {
        return;
      }
    }

    setState(() {
      _isSaving = true;
      _error = null;
    });

    await DataModeController.instance.save(
      mode: _selected,
      apiBaseUrl: _apiBaseUrlController.text.trim(),
    );

    if (!mounted) return;

    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute<void>(
        builder: (_) => const OnboardingFullscreenView(
          tenantName: 'Mi negocio',
        ),
      ),
      (_) => false,
    );
  }

  _PaymentMeta? _getPaymentRequiredMeta() {
    if (_selected == DataMode.api) {
      switch (_selectedApiPlan) {
        case ApiPlan.free:
          return null;
        case ApiPlan.starter:
          return const _PaymentMeta(planName: 'Starter', amountLabel: '\$199 MXN / mes');
        case ApiPlan.plus:
          return const _PaymentMeta(planName: 'Plus', amountLabel: '\$399 MXN / mes');
        case ApiPlan.enterprise:
          return const _PaymentMeta(planName: 'Enterprise', amountLabel: '\$999 MXN / mes');
      }
    }

    if (_selected == DataMode.local && _selectedLocalPlan == LocalPlan.lifetime) {
      return const _PaymentMeta(planName: 'Local de por vida', amountLabel: '\$500 MXN (pago unico)');
    }

    return null;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Configurar modo de datos')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const ShadCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Selecciona como trabajara la app',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
                ),
                SizedBox(height: 6),
                Text('Este paso es obligatorio antes de entrar al sistema.'),
              ],
            ),
          ),
          const SizedBox(height: 12),
          _ModeCard(
            title: 'Nube',
            subtitle: 'Sincroniza datos en la nube y habilita multi-dispositivo.',
            icon: Icons.cloud_outlined,
            selected: _selected == DataMode.api,
            onTap: () => setState(() {
              _selected = DataMode.api;
              _selectedApiPlan = ApiPlan.free;
            }),
          ),
          if (_selected == DataMode.api) ...[
            const SizedBox(height: 12),
            ShadCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Planes en API (Nube)',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 8),
                  _PlanItem(
                    icon: Icons.lock_outline,
                    title: 'Free - \$0 MXN / mes',
                    subtitle: '1 sucursal, 1 usuarios, 50 productos, 50 ordenes/mes.',
                    selected: _selectedApiPlan == ApiPlan.free,
                    onTap: () => setState(() => _selectedApiPlan = ApiPlan.free),
                  ),
                  const SizedBox(height: 8),
                  _PlanItem(
                    icon: Icons.rocket_launch_outlined,
                    title: 'Starter - \$199 MXN / mes',
                    subtitle: '2 sucursales, 5 usuarios, 1,000 productos, 2,000 ordenes/mes.',
                    selected: _selectedApiPlan == ApiPlan.starter,
                    onTap: () => setState(() => _selectedApiPlan = ApiPlan.starter),
                  ),
                  const SizedBox(height: 8),
                  _PlanItem(
                    icon: Icons.trending_up_outlined,
                    title: 'Plus - \$399 MXN / mes',
                    subtitle: '5 sucursales, 15 usuarios, 5,000 productos, 10,000 ordenes/mes.',
                    selected: _selectedApiPlan == ApiPlan.plus,
                    onTap: () => setState(() => _selectedApiPlan = ApiPlan.plus),
                  ),
                  const SizedBox(height: 8),
                  _PlanItem(
                    icon: Icons.workspace_premium_outlined,
                    title: 'Enterprise - \$999 MXN / mes',
                    subtitle: 'Sucursales, usuarios y catalogo a medida + soporte prioritario.',
                    selected: _selectedApiPlan == ApiPlan.enterprise,
                    onTap: () => setState(() => _selectedApiPlan = ApiPlan.enterprise),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 10),
          _ModeCard(
            title: 'Local',
            subtitle: 'Guarda los datos localmente para operacion local.',
            icon: Icons.storage_outlined,
            selected: _selected == DataMode.local,
            onTap: () => setState(() {
              _selected = DataMode.local;
              _selectedLocalPlan = LocalPlan.free;
            }),
          ),
          if (_selected == DataMode.local) ...[
            const SizedBox(height: 12),
            ShadCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Planes en modo local',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 8),
                  _PlanItem(
                    icon: Icons.lock_outline,
                    title: 'Free tier (limitado)',
                    subtitle:
                        'Incluye funciones base con limites para uso inicial y pruebas.',
                    selected: _selectedLocalPlan == LocalPlan.free,
                    onTap: () => setState(() => _selectedLocalPlan = LocalPlan.free),
                  ),
                  const SizedBox(height: 8),
                  _PlanItem(
                    icon: Icons.workspace_premium_outlined,
                    title: 'Pago unico de por vida',
                    subtitle: 'Acceso completo en local por \$500 MXN (un solo pago).',
                    selected: _selectedLocalPlan == LocalPlan.lifetime,
                    onTap: () => setState(() => _selectedLocalPlan = LocalPlan.lifetime),
                  ),
                ],
              ),
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: 10),
            Text(
              _error!,
              style: const TextStyle(color: Color(0xFFB91C1C), fontWeight: FontWeight.w600),
            ),
          ],
          const SizedBox(height: 14),
          ShadPrimaryButton(
            onPressed: _isSaving ? null : _handleContinue,
            label: _isSaving ? 'Guardando...' : 'Continuar',
          ),
        ],
      ),
    );
  }
}

class _PlanItem extends StatelessWidget {
  const _PlanItem({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.selected = false,
    this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFFEFF6FF) : const Color(0xFFF9FAFB),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected ? const Color(0xFF2563EB) : const Color(0xFFE5E7EB),
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Icon(
                icon,
                size: 18,
                color: selected ? const Color(0xFF1D4ED8) : const Color(0xFF374151),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: const TextStyle(color: Color(0xFF6B7280)),
                  ),
                ],
              ),
            ),
            Icon(
              selected ? Icons.radio_button_checked : Icons.radio_button_off,
              color: selected ? const Color(0xFF2563EB) : const Color(0xFF9CA3AF),
              size: 18,
            ),
          ],
        ),
      ),
    );
  }
}

enum ApiPlan {
  free,
  starter,
  plus,
  enterprise,
}

enum LocalPlan {
  free,
  lifetime,
}

class _PaymentMeta {
  const _PaymentMeta({
    required this.planName,
    required this.amountLabel,
  });

  final String planName;
  final String amountLabel;
}

class _ModeCard extends StatelessWidget {
  const _ModeCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        decoration: BoxDecoration(
          color: selected ? const Color(0xFFEFF6FF) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: selected ? const Color(0xFF2563EB) : const Color(0xFFE5E7EB),
            width: selected ? 1.4 : 1,
          ),
        ),
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            CircleAvatar(
              radius: 18,
              backgroundColor: selected ? const Color(0xFFDBEAFE) : const Color(0xFFF3F4F6),
              child: Icon(icon, size: 18, color: selected ? const Color(0xFF1D4ED8) : const Color(0xFF4B5563)),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                  const SizedBox(height: 3),
                  Text(subtitle, style: const TextStyle(color: Color(0xFF6B7280))),
                ],
              ),
            ),
            if (selected) const Icon(Icons.check_circle, color: Color(0xFF2563EB)),
          ],
        ),
      ),
    );
  }
}
