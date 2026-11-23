import { beforeEach } from 'vitest'
import { setActiveAccount } from '@/auth/accountScope'
import { config, RouterLinkStub } from '@vue/test-utils'

config.global.stubs.RouterLink = RouterLinkStub

beforeEach(() => setActiveAccount('auth0|test-user'))
