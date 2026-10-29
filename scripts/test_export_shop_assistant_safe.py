"""Pure export-sanitizer checks, no Docker or providers."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

MODULE = Path(__file__).with_name('export-shop-assistant-safe.py')
spec = importlib.util.spec_from_file_location('safe_export', MODULE)
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)


class ExportTests(unittest.TestCase):
    def setUp(self):
        self.base = json.loads((MODULE.parent.parent / 'workflows/12-shop-telegram-assistant.json').read_text())
        self.raw = copy.deepcopy(self.base)

    def test_removes_private_configuration_and_pinned_data_preserving_layout(self):
        self.raw['pinData'] = {'private': 'fixture-private-value'}
        self.raw['settings']['errorWorkflow'] = 'local-only-id'
        for node in self.raw['nodes']:
            node['credentials'] = {'fixture': {'id': 'local-only-id'}}
            node['position'] = [123, 456]
            if node['name'] == 'Configure Owner and Effects':
                for field in node['parameters']['assignments']['assignments']:
                    field['value'] = '123456' if field['type'] == 'string' else True
        result = exporter.sanitize_export(self.raw, self.base)
        self.assertNotIn('local-only-id', json.dumps(result))
        self.assertNotIn('fixture-private-value', json.dumps(result))
        self.assertTrue(all(n['position'] == [123, 456] for n in result['nodes']))
        result['nodes'] = copy.deepcopy(self.base['nodes'])
        self.assertEqual(result, self.base)

    def test_omitted_defaults_and_empty_editor_field_are_normalized(self):
        for node in self.raw['nodes']:
            node['parameters'].pop('mode', None)
            node['parameters'].pop('method', None)
            if node['type'] == 'n8n-nodes-base.if':
                node['parameters']['conditions']['options']['leftValue'] = ''
        self.assertEqual(exporter.sanitize_export(self.raw, self.base), self.base)

    def test_business_code_or_endpoint_drift_is_rejected(self):
        for kind in ('code', 'httpRequest'):
            raw = copy.deepcopy(self.raw)
            node = next(n for n in raw['nodes'] if n['type'] == 'n8n-nodes-base.' + kind)
            node['parameters']['jsCode' if kind == 'code' else 'url'] = 'unexpected fixture'
            with self.assertRaises(ValueError):
                exporter.sanitize_export(raw, self.base)

    def test_missing_business_code_is_not_treated_as_editor_default(self):
        node = next(n for n in self.raw['nodes'] if n['type'] == 'n8n-nodes-base.code')
        node['parameters'].pop('jsCode')
        with self.assertRaises(ValueError): exporter.sanitize_export(self.raw, self.base)

    def test_connections_or_unknown_execution_override_are_rejected(self):
        self.raw['connections'] = {}
        with self.assertRaises(ValueError): exporter.sanitize_export(self.raw, self.base)
        self.raw = copy.deepcopy(self.base)
        self.raw['nodes'][0]['disabled'] = True
        with self.assertRaises(ValueError): exporter.sanitize_export(self.raw, self.base)

    def test_active_export_or_unexpected_parameter_is_rejected(self):
        self.raw['active'] = True
        with self.assertRaises(ValueError): exporter.sanitize_export(self.raw, self.base)
        self.raw = copy.deepcopy(self.base)
        self.raw['nodes'][0]['parameters']['unexpected'] = 'fixture'
        with self.assertRaises(ValueError): exporter.sanitize_export(self.raw, self.base)

    def test_explicit_published_source_is_exported_inactive_without_version_metadata(self):
        self.raw['active'] = True
        self.raw['activeVersionId'] = 'fixture-published-version'
        result = exporter.sanitize_export(self.raw, self.base, published=True)
        self.assertEqual(result, self.base)
        self.assertNotIn('fixture-published-version', json.dumps(result))

    def test_published_selection_requires_active_version(self):
        with self.assertRaises(ValueError): exporter.sanitize_export(self.raw, self.base, published=True)
        self.raw['active'] = True
        with self.assertRaises(ValueError): exporter.sanitize_export(self.raw, self.base, published=True)


if __name__ == '__main__': unittest.main()
