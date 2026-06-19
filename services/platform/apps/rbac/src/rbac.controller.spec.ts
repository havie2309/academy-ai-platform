import { Test, TestingModule } from '@nestjs/testing'
import { RbacController } from './rbac.controller'
import { RbacService } from './rbac.service'

describe('RbacController', () => {
  let rbacController: RbacController

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [RbacController],
      providers: [
        {
          provide: RbacService,
          useValue: {
            getCurrentAccess: jest.fn(),
          },
        },
      ],
    }).compile()

    rbacController = app.get<RbacController>(RbacController)
  })

  it('returns health payload', () => {
    expect(rbacController.health()).toEqual({
      status: 'ok',
      service: 'rbac',
    })
  })
})
