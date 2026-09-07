import 'package:flutter/material.dart';
import 'package:poszxor_app/app_shell.dart';
import 'package:poszxor_app/core/ui/shad_ui.dart';

class OnboardingFullscreenView extends StatefulWidget {
  const OnboardingFullscreenView({
    super.key,
    this.tenantName = 'Sin nombre',
  });

  final String tenantName;

  @override
  State<OnboardingFullscreenView> createState() => _OnboardingFullscreenViewState();
}

class _OnboardingFullscreenViewState extends State<OnboardingFullscreenView> {
  int _step = 1;
  bool _isSaving = false;
  String? _errorMessage;

  String _selectedBusinessType = 'TIENDA_ABARROTES';
  String _selectedPlan = 'FREE';

  final List<String> _categoryDrafts = [];
  final TextEditingController _categoryController = TextEditingController();

  final TextEditingController _storeNameController = TextEditingController();
  final TextEditingController _storePhoneController = TextEditingController();
  final TextEditingController _storeAddressController = TextEditingController();
  final TextEditingController _storeCityController = TextEditingController();
  final TextEditingController _storeStateController = TextEditingController();

  final TextEditingController _customerNameController = TextEditingController();
  final TextEditingController _customerPhoneController = TextEditingController();
  final TextEditingController _customerEmailController = TextEditingController();
  final TextEditingController _customerNotesController = TextEditingController();

  static const _businessTypes = <({String id, String label})>[
    (id: 'FERRETERIA', label: 'Ferreteria'),
    (id: 'TIENDA_ABARROTES', label: 'Tienda de abarrotes'),
    (id: 'FARMACIA', label: 'Farmacia'),
    (id: 'PAPELERIA', label: 'Papeleria'),
    (id: 'RESTAURANTE', label: 'Restaurante'),
    (id: 'SERVICIOS', label: 'Servicios'),
  ];

  static const _suggestedByType = <String, List<String>>{
    'FERRETERIA': ['Tornillos', 'Tuercas', 'Rondanas', 'Herramientas'],
    'TIENDA_ABARROTES': ['Bebidas', 'Botanas', 'Limpieza', 'Despensa'],
    'FARMACIA': ['Medicamentos', 'Cuidado personal', 'Suplementos', 'Primeros auxilios'],
    'PAPELERIA': ['Cuadernos', 'Lapices y plumas', 'Impresion', 'Manualidades'],
    'RESTAURANTE': ['Entradas', 'Platos fuertes', 'Bebidas', 'Postres'],
    'SERVICIOS': ['Consultoria', 'Mantenimiento', 'Instalacion', 'Soporte'],
  };

  List<String> get _suggestedCategories => _suggestedByType[_selectedBusinessType] ?? const [];

  @override
  void dispose() {
    _categoryController.dispose();
    _storeNameController.dispose();
    _storePhoneController.dispose();
    _storeAddressController.dispose();
    _storeCityController.dispose();
    _storeStateController.dispose();
    _customerNameController.dispose();
    _customerPhoneController.dispose();
    _customerEmailController.dispose();
    _customerNotesController.dispose();
    super.dispose();
  }

  Future<void> _saveAndNext() async {
    setState(() {
      _isSaving = true;
      _errorMessage = null;
    });
    await Future<void>.delayed(const Duration(milliseconds: 250));
    if (!mounted) return;
    setState(() {
      _step = (_step + 1).clamp(1, 5);
      _isSaving = false;
    });
  }

  void _skipAll() {
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute<void>(builder: (_) => const AppShell()),
      (_) => false,
    );
  }

  void _finish() {
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute<void>(builder: (_) => const AppShell()),
      (_) => false,
    );
  }

  void _addCategory() {
    final value = _categoryController.text.trim();
    if (value.isEmpty) return;
    if (_categoryDrafts.any((item) => item.toLowerCase() == value.toLowerCase())) {
      return;
    }
    setState(() {
      _categoryDrafts.add(value);
      _categoryController.clear();
    });
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
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                Row(
                  children: [
                    const Text(
                      'Onboarding',
                      style: TextStyle(fontSize: 12, color: Color(0xFF2563EB), fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(width: 8),
                    if (_step > 1)
                      ShadSecondaryButton(
                        onPressed: _isSaving ? null : () => setState(() => _step -= 1),
                        label: 'Atras',
                      ),
                    const Spacer(),
                    ShadSecondaryButton(
                      onPressed: _isSaving ? null : _skipAll,
                      label: 'Saltar onboarding',
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                const Align(
                  alignment: Alignment.centerLeft,
                  child: Text('Configuracion inicial', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
                ),
                const SizedBox(height: 4),
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'Tenant: ${widget.tenantName}',
                    style: const TextStyle(color: Color(0xFF6B7280)),
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: List.generate(5, (index) {
                    final stepNo = index + 1;
                    final active = _step >= stepNo;
                    return Expanded(
                      child: Container(
                        margin: EdgeInsets.only(right: index == 4 ? 0 : 6),
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        decoration: BoxDecoration(
                          color: active ? const Color(0xFF2563EB) : const Color(0xFFE5E7EB),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Center(
                          child: Text(
                            'Paso $stepNo',
                            style: TextStyle(
                              color: active ? Colors.white : const Color(0xFF6B7280),
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                    );
                  }),
                ),
                const SizedBox(height: 12),
                Expanded(
                  child: ShadCard(
                    child: _buildStepContent(),
                  ),
                ),
                if (_errorMessage != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    _errorMessage!,
                    style: const TextStyle(color: Color(0xFFB91C1C), fontWeight: FontWeight.w600),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStepContent() {
    if (_step == 1) {
      return ListView(
        children: [
          const Text('Selecciona tu tipo de negocio', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _businessTypes.map((item) {
              final selected = _selectedBusinessType == item.id;
              return ChoiceChip(
                label: Text(item.label),
                selected: selected,
                onSelected: (_) => setState(() => _selectedBusinessType = item.id),
              );
            }).toList(),
          ),
          const SizedBox(height: 12),
          const Text('Selecciona tu plan', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: [
              ChoiceChip(
                label: const Text('FREE'),
                selected: _selectedPlan == 'FREE',
                onSelected: (_) => setState(() => _selectedPlan = 'FREE'),
              ),
              ChoiceChip(
                label: const Text('STARTER'),
                selected: _selectedPlan == 'STARTER',
                onSelected: (_) => setState(() => _selectedPlan = 'STARTER'),
              ),
              ChoiceChip(
                label: const Text('PRO'),
                selected: _selectedPlan == 'PRO',
                onSelected: (_) => setState(() => _selectedPlan = 'PRO'),
              ),
            ],
          ),
          const SizedBox(height: 14),
          ShadPrimaryButton(
            onPressed: _isSaving
                ? null
                : () {
                    if (_categoryDrafts.isEmpty) {
                      _categoryDrafts.addAll(_suggestedCategories);
                    }
                    _saveAndNext();
                  },
            label: _isSaving ? 'Guardando...' : 'Continuar configuracion',
          ),
        ],
      );
    }

    if (_step == 2) {
      return ListView(
        children: [
          const Text('Crea tus categorias', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Text('Sugeridas para tu negocio: ${_suggestedCategories.join(', ')}'),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _categoryController,
                  decoration: const InputDecoration(hintText: 'Nombre de categoria'),
                  onSubmitted: (_) => _addCategory(),
                ),
              ),
              const SizedBox(width: 8),
              ShadPrimaryButton(
                onPressed: _addCategory,
                label: 'Agregar',
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (_categoryDrafts.isEmpty)
            const Text('No hay categorias capturadas.', style: TextStyle(color: Color(0xFF6B7280)))
          else
            ..._categoryDrafts.map((name) => Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    children: [
                      Expanded(child: Text(name)),
                      IconButton(
                        onPressed: () => setState(() => _categoryDrafts.remove(name)),
                        icon: const Icon(Icons.delete_outline, color: Color(0xFFDC2626)),
                      ),
                    ],
                  ),
                )),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: ShadSecondaryButton(
                  onPressed: _isSaving ? null : _saveAndNext,
                  label: 'Omitir',
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ShadPrimaryButton(
                  onPressed: _isSaving ? null : _saveAndNext,
                  label: _isSaving ? 'Guardando...' : 'Guardar y continuar',
                ),
              ),
            ],
          ),
        ],
      );
    }

    if (_step == 3) {
      return ListView(
        children: [
          const Text('Configura tu sucursal principal', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
          const SizedBox(height: 10),
          TextField(controller: _storeNameController, decoration: const InputDecoration(hintText: 'Nombre de sucursal *')),
          const SizedBox(height: 8),
          TextField(controller: _storePhoneController, decoration: const InputDecoration(hintText: 'Telefono')),
          const SizedBox(height: 8),
          TextField(controller: _storeAddressController, decoration: const InputDecoration(hintText: 'Direccion')),
          const SizedBox(height: 8),
          TextField(controller: _storeCityController, decoration: const InputDecoration(hintText: 'Ciudad')),
          const SizedBox(height: 8),
          TextField(controller: _storeStateController, decoration: const InputDecoration(hintText: 'Estado')),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: ShadSecondaryButton(
                  onPressed: _isSaving ? null : _saveAndNext,
                  label: 'Omitir',
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ShadPrimaryButton(
                  onPressed: _isSaving
                      ? null
                      : () {
                          if (_storeNameController.text.trim().isEmpty) {
                            setState(() => _errorMessage = 'El nombre de la sucursal es obligatorio.');
                            return;
                          }
                          _saveAndNext();
                        },
                  label: _isSaving ? 'Guardando...' : 'Guardar y continuar',
                ),
              ),
            ],
          ),
        ],
      );
    }

    if (_step == 4) {
      return ListView(
        children: [
          const Text('Crea tu primer cliente (opcional)', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
          const SizedBox(height: 10),
          TextField(controller: _customerNameController, decoration: const InputDecoration(hintText: 'Nombre completo')),
          const SizedBox(height: 8),
          TextField(controller: _customerPhoneController, decoration: const InputDecoration(hintText: 'Telefono')),
          const SizedBox(height: 8),
          TextField(controller: _customerEmailController, decoration: const InputDecoration(hintText: 'Email')),
          const SizedBox(height: 8),
          TextField(controller: _customerNotesController, decoration: const InputDecoration(hintText: 'Notas')),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: ShadSecondaryButton(
                  onPressed: _isSaving ? null : _saveAndNext,
                  label: 'Omitir',
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ShadPrimaryButton(
                  onPressed: _isSaving ? null : _saveAndNext,
                  label: _isSaving ? 'Guardando...' : 'Guardar y continuar',
                ),
              ),
            ],
          ),
        ],
      );
    }

    return ListView(
      children: [
        const Text('Listo para comenzar', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        const Text('Tu configuracion inicial ha sido completada.'),
        const SizedBox(height: 12),
        ShadPrimaryButton(
          onPressed: _finish,
          label: 'Finalizar onboarding',
        ),
      ],
    );
  }
}
