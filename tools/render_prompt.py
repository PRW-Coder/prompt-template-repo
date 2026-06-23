
import yaml
from jinja2 import Template

def load_template(path):
    with open(path, 'r') as file:
        return yaml.safe_load(file)

def render_prompt(template_data, variables):
    system_template = Template(template_data['prompt']['system'])
    user_template = Template(template_data['prompt']['user'])

    return {
        "system": system_template.render(**variables),
        "user": user_template.render(**variables),
        "parameters": template_data.get("parameters", {})
    }

if __name__ == "__main__":
    template = load_template("../templates/summarization/basic.yaml")

    rendered = render_prompt(template, {
        "text": "Artificial Intelligence is transforming industries..."
    })

    print("SYSTEM:\n", rendered["system"])
    print("USER:\n", rendered["user"])
