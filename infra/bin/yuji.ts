#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { createStacks } from '../lib/app';

createStacks(new App());
