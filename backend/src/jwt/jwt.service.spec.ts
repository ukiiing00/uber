import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from './jwt.service';
import { CONFIG_OPTIONS } from 'src/common/common.contants';
import * as jwt from 'jsonwebtoken';



const TEST_KEY = 'testPrivateKey';

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => "TOKEN"),
  verify: jest.fn(() => ({ id: 1 })),
}));


describe('JwtService', () => {
  let service: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JwtService,{
        provide: CONFIG_OPTIONS,
        useValue: {
          privateKey: TEST_KEY,
        },
      },],
    }).compile();

    service = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sign', () => {
    it('should return a token', () => {
      const token = service.sign({ id: 1 });
      expect(token).toBe('TOKEN');
      expect(jwt.sign).toHaveBeenCalledTimes(1);
      expect(jwt.sign).toHaveBeenCalledWith({ id: 1 }, TEST_KEY);
    });
  });
  describe('verify', () => {
    it('should return the decoded token', () => {
      const token = service.verify('TOKEN');
      expect(token).toEqual({ id: 1 });
      expect(jwt.verify).toHaveBeenCalledTimes(1);
      expect(jwt.verify).toHaveBeenCalledWith('TOKEN', TEST_KEY);
    });
  });

});
