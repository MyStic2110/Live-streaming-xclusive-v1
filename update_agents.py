import os
import re

agents_dir = 'python-agent/agents'
files_to_update = [
    'aivyuh/aivyuh.py',
    'astra/astra.py',
    'bi2/bi2_agent.py',
    'lina/lina.py',
    'martech/martech_agent.py',
    'nova/nova.py',
    'octane/octane.py',
    'seva/seva.py',
    'vision/vision_agent.py'
]

import_statement = 'from integrations.observyze import get_observyze_llm\n'

for rel_path in files_to_update:
    filepath = os.path.join(agents_dir, rel_path)
    if not os.path.exists(filepath):
        print(f'File not found: {filepath}')
        continue
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    if 'get_observyze_llm' in content and 'openai.LLM(' not in content:
        print(f'Already updated: {rel_path}')
        continue

    # Add import
    if import_statement not in content:
        match = re.search(r'(from livekit[^\n]*\n|import openai[^\n]*\n)', content)
        if match:
            content = content[:match.end()] + import_statement + content[match.end():]
        else:
            content = import_statement + content
            
    # Parse model
    model_match = re.search(r'llm_plugin\s*=\s*openai\.LLM\s*\([^)]*model\s*=\s*[\"\']([^\"\']+)[\"\']', content)
    model = model_match.group(1) if model_match else 'openai/gpt-4o-mini'
    if not model.startswith('openai/'):
        if 'gpt' in model:
            model = 'openai/' + model

    start_idx = content.find('openai.LLM(')
    if start_idx != -1:
        # We know the opening parenthesis is at start_idx + 10
        # Let's track parens properly starting AFTER the first '('
        paren_count = 0
        end_idx = -1
        # Start looking from inside the first parenthesis
        for i in range(start_idx + 11, len(content)):
            if content[i] == '(':
                paren_count += 1
            elif content[i] == ')':
                if paren_count == 0:
                    end_idx = i
                    break
                paren_count -= 1
        
        if end_idx != -1:
            replacement = f'get_observyze_llm(model=\"{model}\")'
            content = content[:start_idx] + replacement + content[end_idx+1:]
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f'Successfully updated: {rel_path}')
        else:
            print(f'Failed to parse openai.LLM block in {rel_path}')
    else:
        print(f'No openai.LLM block found in {rel_path}')
