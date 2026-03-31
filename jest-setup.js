// Jest setup provided by Grafana scaffolding
import './.config/jest-setup'

// Polyfill TextEncoder/TextDecoder for @grafana/ui compatibility with jsdom
import { TextDecoder, TextEncoder } from 'util'
Object.assign(global, { TextDecoder, TextEncoder })
