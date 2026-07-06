from setuptools import setup, find_packages
import os

setup(
    name="krims-code-cli",
    version="1.5.7",
    author="Krishiv PB",
    author_email="krylobloxyt@gmail.com",
    description="Krims Code AI — Universal AI Gateway CLI (Native Python Edition)",
    long_description=open("README.md", "r", encoding="utf-8").read() if os.path.exists("README.md") else "",
    long_description_content_type="text/markdown",
    url="https://github.com/Krylo-60/krims-code-cli",
    packages=find_packages(),
    install_requires=[
        "krims-code-sdk>=0.1.0"
    ],
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
    python_requires=">=3.7",
)
