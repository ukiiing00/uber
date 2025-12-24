import { Test, TestingModule } from "@nestjs/testing";
import { MailService } from "./mail.service";
import { CONFIG_OPTIONS } from "src/common/common.contants";

jest.mock('axios', () => ({
    post: jest.fn(),
}));

jest.mock('form-data', () => {
    return jest.fn().mockImplementation(() => ({
        append: jest.fn(),
        getHeaders: jest.fn(),
    }));
});

describe('MailService', () => {
    let service: MailService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [MailService,{
                provide: CONFIG_OPTIONS,
                useValue: {
                    apiKey: 'testApiKey',
                    domain: 'testDomain',
                    fromEmail: 'test@test.com',
                },
            },],
        }).compile();

        service = module.get<MailService>(MailService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('sendVerificationEmail', () => {
        it('should call sendEmail', () => {
            const sendVerificationEmailArgs = {
                email: 'test@test.com',
                code: 'code',
            };
            jest.spyOn(service, 'sendEmail').mockImplementation(async () => {});
            service.sendVerificationEmail(sendVerificationEmailArgs.email, sendVerificationEmailArgs.code,);
            expect(service.sendEmail).toHaveBeenCalledTimes(1);
            expect(service.sendEmail).toHaveBeenCalledWith('Verify Your Email', 'verify-email', [{ key: 'code', value: sendVerificationEmailArgs.code }, { key: 'username', value: sendVerificationEmailArgs.email }]);
        });
    });
})