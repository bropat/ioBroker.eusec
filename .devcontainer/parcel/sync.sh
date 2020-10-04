#!/bin/bash
rsync -aiz --inplace --exclude={'node_modules','.git','.cache','admin/build'} /workspace/ /usr/workspace