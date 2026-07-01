from setuptools import setup, find_packages
import os
import shutil
import json

# Read version from package.json
pkg_json_path = 'package.json'
if not os.path.exists(pkg_json_path):
    pkg_json_path = os.path.join('krims_pip', 'node_project', 'package.json')

with open(pkg_json_path, 'r', encoding='utf-8') as f:
    pkg_data = json.load(f)
version = pkg_data.get('version', '1.0.0')

# Copy Node project files into Krims Code_pip/node_project for clean packaging
if os.path.exists('bin') and os.path.exists('src'):
    dest_dir = os.path.join('krims_pip', 'node_project')
    if os.path.exists(dest_dir):
        shutil.rmtree(dest_dir)
    os.makedirs(dest_dir)

    # Copy directories
    shutil.copytree('bin', os.path.join(dest_dir, 'bin'))
    shutil.copytree('src', os.path.join(dest_dir, 'src'))
    shutil.copyfile('package.json', os.path.join(dest_dir, 'package.json'))
    if os.path.exists('package-lock.json'):
        shutil.copyfile('package-lock.json', os.path.join(dest_dir, 'package-lock.json'))

def package_files(directory):
    paths = []
    for (path, directories, filenames) in os.walk(directory):
        for filename in filenames:
            rel_path = os.path.relpath(os.path.join(path, filename), 'krims_pip')
            paths.append(rel_path)
    return paths

setup(
    name="krims-code-cli",
    version=version,
    author="Krishiv PB",
    author_email="krylobloxyt@gmail.com",
    description="Krims Code AI — Universal AI Gateway CLI (Python Wrapper)",
    long_description=open("README.md", "r", encoding="utf-8").read() if os.path.exists("README.md") else "",
    long_description_content_type="text/markdown",
    url="https://github.com/Krylo-60/krims-code-cli",
    packages=find_packages(),
    package_data={
        "krims_pip": package_files(os.path.join('krims_pip', 'node_project')),
    },
    include_package_data=True,
    entry_points={
        "console_scripts": [
            "krims-pip=krims_pip.cli:main",
        ],
    },
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
    python_requires=">=3.6",
)
