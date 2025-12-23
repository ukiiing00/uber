# NestJS 테스트 종합 가이드

## 🎯 목표

**실제 DB, JWT, 메일 서버 없이 UsersService의 로직만 순수하게 테스트하자!**

이것이 단위 테스트(Unit Test)의 본질입니다.

## 📚 목차

1. [문제 상황](#문제-상황)
2. [해결 방법: Mock 객체](#해결-방법-mock-객체)
3. [타입 정의](#타입-정의)
4. [테스트 모듈 생성](#테스트-모듈-생성)
5. [인스턴스 가져오기](#인스턴스-가져오기)
6. [테스트 작성](#테스트-작성)
7. [전체 아키텍처](#전체-아키텍처)
8. [핵심 개념](#핵심-개념)

---

## 문제 상황

```typescript
// UsersService는 4개의 의존성이 필요
@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly users: Repository<User>,              // 실제 PostgreSQL
        @InjectRepository(Verification)
        private readonly verifications: Repository<Verification>,  // 실제 PostgreSQL
        private readonly jwtService: JwtService,               // 실제 JWT 생성
        private readonly mailService: MailService              // 실제 메일 전송
    ) {}
    
    async createAccount({ email, password, role }) {
        const exists = await this.users.findOne({ where: { email } });
        if (exists) {
            return { ok: false, error: 'User exists' };
        }
        const user = this.users.create({ email, password, role });
        await this.users.save(user);
        return { ok: true };
    }
}
```

### 문제점:
- 🚫 실제 DB가 필요함 (느림, 데이터 오염)
- 🚫 실제 JWT 서버 필요
- 🚫 실제 메일 서버 필요
- 🚫 외부 의존성으로 테스트 불안정
- 🚫 로직만 순수하게 테스트 불가능

---

## 해결 방법: Mock 객체

### Mock이란?

**Mock = 가짜 객체**

실제로 DB에 접근하지 않지만, DB처럼 보이는 가짜 객체입니다.

### Mock 생성

```typescript
// Mock Repository: 실제 DB 대신 사용
const mockRepository = {
    findOne: jest.fn(),  // Mock 함수
    save: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    merge: jest.fn(),
};

// Mock JwtService
const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
};

// Mock MailService
const mockMailService = {
    sendVerificationEmail: jest.fn(),
};
```

### jest.fn()의 역할

```typescript
const mockFn = jest.fn();

// 1️⃣ 가짜 함수 (실제 로직 없음)
mockFn();  // 호출 가능

// 2️⃣ 반환값 제어
mockFn.mockResolvedValue({ id: 1 });
await mockFn();  // { id: 1 } 반환

// 3️⃣ 호출 추적
mockFn('test');
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledWith('test');
expect(mockFn).toHaveBeenCalledTimes(1);
```

### 중요: useValue에 정의한 메소드만 존재

```typescript
// 실제 Repository: 50개 이상의 메소드
interface Repository<Entity> {
    findOne(...): Promise<Entity>
    find(...): Promise<Entity[]>
    save(...): Promise<Entity>
    create(...): Entity
    update(...): Promise<UpdateResult>
    delete(...): Promise<DeleteResult>
    // ... 50개 이상
}

// Mock Repository: 필요한 것만 정의
const mockRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    merge: jest.fn(),
    // 이 5개만 사용 가능!
};

// ✅ 사용 가능
mockRepository.findOne.mockResolvedValue({ id: 1 });

// ❌ 에러! (정의하지 않음)
mockRepository.find()  // TypeError: not a function
mockRepository.update()  // TypeError: not a function
```

---

## 타입 정의

### MockRepository 타입

```typescript
type MockRepository<T = any> = Partial<Record<keyof Repository<T>, jest.Mock>>;

let usersRepository: MockRepository<User>;
```

### 타입 분해

#### 1. `keyof Repository<T>`
"Repository<T> 타입의 모든 키(메소드 이름)를 가져와"

```typescript
keyof Repository<User>
// = 'findOne' | 'save' | 'create' | 'delete' | 'merge' | ...
```

#### 2. `Record<K, V>`
"K를 키로, V를 값으로 하는 객체 타입을 만들어"

```typescript
Record<'findOne' | 'save', jest.Mock>
// = {
//     findOne: jest.Mock,
//     save: jest.Mock
//   }
```

#### 3. `Partial<T>`
"모든 속성을 선택적(optional)으로 만들어"

```typescript
Partial<{ findOne: jest.Mock, save: jest.Mock }>
// = {
//     findOne?: jest.Mock,
//     save?: jest.Mock
//   }
```

#### 4. 조합

```typescript
type MockRepository<T> = Partial<Record<keyof Repository<T>, jest.Mock>>;

// 결과:
type MockRepository<User> = {
    findOne?: jest.Mock,
    save?: jest.Mock,
    create?: jest.Mock,
    delete?: jest.Mock,
    // ... Repository의 모든 메소드 (선택적)
}
```

### 타입의 장점

```typescript
let usersRepository: MockRepository<User>;

// ✅ 타입 체크 통과 (findOne은 Repository에 있음)
usersRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
};

// ✅ 일부만 정의 가능 (Partial 덕분)
usersRepository = {
    findOne: jest.fn(),
    // save, create 등은 정의 안 해도 OK
};

// ❌ 타입 에러 (invalidMethod는 Repository에 없음)
usersRepository = {
    invalidMethod: jest.fn(),  // 컴파일 에러!
};

// ✅ 타입 안전하게 사용
usersRepository.findOne!.mockResolvedValue({ id: 1 });
```

---

## 테스트 모듈 생성

### Test.createTestingModule()

**실제 애플리케이션과 격리된 테스트 환경을 만드는 핵심 메서드**

```typescript
beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
        providers: [
            UsersService,  // 테스트할 대상
            
            // "User Repository를 요청하면 mockRepository를 줘"
            {
                provide: getRepositoryToken(User),
                useValue: mockRepository,
            },
            
            // "Verification Repository를 요청하면 mockRepository를 줘"
            {
                provide: getRepositoryToken(Verification),
                useValue: mockRepository,
            },
            
            // "JwtService를 요청하면 mockJwtService를 줘"
            {
                provide: JwtService,
                useValue: mockJwtService,
            },
            
            // "MailService를 요청하면 mockMailService를 줘"
            {
                provide: MailService,
                useValue: mockMailService,
            },
        ],
    }).compile();  // ← 모듈 컴파일: DI 컨테이너 구성 완료
    
    service = module.get<UsersService>(UsersService);
    usersRepository = module.get(getRepositoryToken(User));
});
```

### 동작 흐름

```typescript
// 1. createTestingModule() - 테스트 모듈 빌더 생성
const module = await Test.createTestingModule({
    providers: [...]
})

// 2. .compile() - 의존성 해결 및 DI 컨테이너 구성
.compile();

// 3. module.get() - 컨테이너에서 인스턴스 가져오기
service = module.get<UsersService>(UsersService);
```

### provide와 useValue

```typescript
{
    provide: getRepositoryToken(User),  // "이것을 요청하면"
    useValue: mockRepository,           // "이 값을 줘"
}

// UsersService 생성 시:
constructor(
    @InjectRepository(User)  // ← getRepositoryToken(User) 요청
    private readonly users: Repository<User>  // ← mockRepository 주입됨!
) {}
```

---

## 인스턴스 가져오기

### module.get()의 역할

**DI 컨테이너에서 실제로 주입된 인스턴스를 가져오는 것**

```typescript
// Service 가져오기
service = module.get<UsersService>(UsersService);

// Mock Repository 가져오기
usersRepository = module.get(getRepositoryToken(User));
```

### 왜 module.get()을 사용하는가?

#### 이유 1: 같은 인스턴스 보장

```typescript
// UsersService 내부
class UsersService {
    constructor(
        private readonly users: Repository<User>  // ← mockRepository 주입
    ) {}
}

// 테스트에서
usersRepository = module.get(getRepositoryToken(User));
// ↑ UsersService 내부의 this.users와 정확히 같은 객체!

// 확인
console.log(usersRepository === service['users']);  // true!
```

#### 이유 2: Mock 동작 제어

```typescript
// module.get()으로 가져온 객체
usersRepository = module.get(getRepositoryToken(User));

// 이제 이 객체의 동작을 제어할 수 있음
usersRepository.findOne.mockResolvedValue({ id: 1 });

// service 내부에서 호출
await service.createAccount(...);
  ↓
this.users.findOne(...)  // ← usersRepository와 같은 객체
  ↓
mockResolvedValue로 설정한 값 반환!
```

### 변수의 역할

```typescript
// 1. 타입 선언 (컴파일 타임)
let usersRepository: MockRepository<User>;
// "이 변수는 Mock Repository 타입이야" (아직 값 없음)

// 2. 값 할당 (런타임)
usersRepository = module.get(getRepositoryToken(User));
// "DI 컨테이너에서 실제 주입된 mockRepository 가져와서 할당"

// 3. 결과
usersRepository === mockRepository  // true
usersRepository === service['users']  // true (같은 인스턴스!)
```

---

## 테스트 작성

### AAA 패턴

```typescript
describe('createAccount', () => {
    it('should fail if user exists', async () => {
        // Arrange: 준비 - Mock 동작 설정
        usersRepository.findOne!.mockResolvedValue({ 
            id: 1, 
            email: 'test@test.com' 
        });
        
        // Act: 실행 - 테스트할 메서드 호출
        const result = await service.createAccount({
            email: 'test@test.com',
            password: 'password',
            role: 0,
        });
        
        // Assert: 검증 - 결과 확인
        expect(result).toMatchObject({ 
            ok: false, 
            error: 'There is a user with that email already' 
        });
        
        // Mock 호출 검증
        expect(usersRepository.findOne).toHaveBeenCalledTimes(1);
        expect(usersRepository.findOne).toHaveBeenCalledWith({
            where: { email: 'test@test.com' }
        });
    });
    
    it('should create a new user', async () => {
        // Arrange
        usersRepository.findOne.mockResolvedValue(null);  // 사용자 없음
        usersRepository.create.mockReturnValue({
            email: 'new@test.com',
            password: 'hashed',
            role: 0,
        });
        usersRepository.save.mockResolvedValue({
            id: 1,
            email: 'new@test.com',
        });
        
        // Act
        const result = await service.createAccount({
            email: 'new@test.com',
            password: 'password',
            role: 0,
        });
        
        // Assert
        expect(result).toEqual({ ok: true });
        expect(usersRepository.create).toHaveBeenCalledWith({
            email: 'new@test.com',
            password: 'password',
            role: 0,
        });
        expect(usersRepository.save).toHaveBeenCalled();
    });
});
```

### Mock 초기화

```typescript
beforeEach(() => {
    jest.clearAllMocks();  // 각 테스트 전 Mock 호출 기록 초기화
});
```

---

## 전체 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    테스트 환경                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1️⃣ Mock 객체 정의                                          │
│     const mockRepository = { findOne: jest.fn(), ... }     │
│                                                              │
│  2️⃣ 타입 정의 (TypeScript)                                  │
│     let usersRepository: MockRepository<User>              │
│                                                              │
│  3️⃣ Test Module 생성 (DI 컨테이너)                         │
│     ┌──────────────────────────────────────┐               │
│     │  Test.createTestingModule()          │               │
│     │    providers:                         │               │
│     │      - UsersService                   │               │
│     │      - Repository<User> → mockRepo    │               │
│     │      - JwtService → mockJwt           │               │
│     │      - MailService → mockMail         │               │
│     └──────────────────────────────────────┘               │
│                    ↓ .compile()                             │
│     ┌──────────────────────────────────────┐               │
│     │      DI Container (컴파일됨)          │               │
│     │                                       │               │
│     │  UsersService ←┐                     │               │
│     │                │                     │               │
│     │  mockRepository ←┼─ 주입              │               │
│     │                │                     │               │
│     │  mockJwtService ←┤                   │               │
│     │                │                     │               │
│     │  mockMailService ←┘                  │               │
│     └──────────────────────────────────────┘               │
│                                                              │
│  4️⃣ 인스턴스 가져오기                                        │
│     service = module.get(UsersService)                     │
│     usersRepository = module.get(getRepositoryToken(User)) │
│                                                              │
│  5️⃣ Mock 동작 제어                                          │
│     usersRepository.findOne.mockResolvedValue(...)         │
│                                                              │
│  6️⃣ 테스트 실행                                              │
│     await service.createAccount(...)                       │
│        ↓                                                    │
│     this.users.findOne() 호출                              │
│        ↓                                                    │
│     mockRepository.findOne() 실행 (DB 접근 X)              │
│        ↓                                                    │
│     mockResolvedValue로 설정한 값 반환                      │
│                                                              │
│  7️⃣ 검증                                                     │
│     expect(result).toBe(...)                               │
│     expect(usersRepository.findOne).toHaveBeenCalled()     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 핵심 개념

### jest.fn()

```typescript
const mockFunction = jest.fn();

// 기본 사용
mockFunction();  // 호출 가능

// 반환값 설정
mockFunction.mockReturnValue('value');
mockFunction.mockResolvedValue({ id: 1 });  // Promise 반환
mockFunction.mockRejectedValue(new Error('error'));  // 에러 던지기

// 호출 추적
expect(mockFunction).toHaveBeenCalled();
expect(mockFunction).toHaveBeenCalledTimes(2);
expect(mockFunction).toHaveBeenCalledWith('arg1', 'arg2');

// 호출 기록
console.log(mockFunction.mock.calls);
// [['arg1'], ['arg2']]
```

### useValue vs useClass vs useFactory

```typescript
// useValue: 고정된 값/객체
{
    provide: JwtService,
    useValue: mockJwtService,
}

// useClass: 다른 클래스로 대체
{
    provide: JwtService,
    useClass: MockJwtService,
}

// useFactory: 동적으로 생성
{
    provide: JwtService,
    useFactory: () => new JwtService(config),
}
```

### module.get()

```typescript
// 기본 사용
const service = module.get<UsersService>(UsersService);

// Repository 가져오기
const repository = module.get(getRepositoryToken(User));

// Custom Provider 가져오기
const config = module.get(CONFIG_OPTIONS);
```

### MockRepository 타입

```typescript
type MockRepository<T = any> = Partial<Record<keyof Repository<T>, jest.Mock>>;

// 의미:
// - Repository<T>의 모든 메소드를
// - jest.Mock 타입으로 변환하고
// - 선택적으로 만들어서
// - 필요한 것만 구현 가능하게
```

---

## 실제 동작 흐름

```typescript
// 1. 테스트 시작
it('should fail if user exists', async () => {
    
    // 2. Mock 설정
    usersRepository.findOne.mockResolvedValue({ id: 1, email: 'test@test.com' });
    
    // 3. Service 호출
    await service.createAccount({ 
        email: 'test@test.com', 
        password: 'password',
        role: 0 
    });
    
    // 4. Service 내부 (users.service.ts)
    async createAccount({ email, password, role }) {
        // 5. Repository 호출
        const exists = await this.users.findOne({ where: { email } });
        // ↓ 
        // 실제로는 mockRepository.findOne() 호출
        // ↓ (DB 접근 X)
        // mockResolvedValue({ id: 1, email: 'test@test.com' }) 반환
        // ↓
        // exists = { id: 1, email: 'test@test.com' }
        
        // 6. 로직 실행
        if (exists) {  // true
            return { ok: false, error: 'There is a user with that email already' };
        }
        // ...
    }
    
    // 7. 검증
    expect(result).toMatchObject({ ok: false, error: '...' });
    expect(usersRepository.findOne).toHaveBeenCalledTimes(1);
});
```

---

## 환경 비교

### 실제 프로덕션 환경

```typescript
🏢 Production
  └─ UsersService
      ├─ Repository<User> (실제 PostgreSQL)
      │   └─ 실제 DB 쿼리 실행
      ├─ JwtService (실제 JWT 생성)
      │   └─ 실제 토큰 생성/검증
      └─ MailService (실제 이메일 전송)
          └─ 실제 메일 서버 통신

단점:
- 느림 (DB 접근, 네트워크 통신)
- 외부 의존성 (DB, 메일 서버 필요)
- 데이터 오염 가능
- 불안정 (네트워크, 서버 상태)
```

### 테스트 환경

```typescript
🧪 Test
  └─ UsersService
      ├─ Mock Repository<User>
      │   └─ jest.fn() (메모리, 즉시 반환)
      ├─ Mock JwtService
      │   └─ jest.fn() (가짜 토큰)
      └─ Mock MailService
          └─ jest.fn() (메일 전송 안 함)

장점:
- ⚡ 빠름 (실제 DB/네트워크 없음)
- 🔒 격리 (외부 의존성 없음)
- 🎮 제어 (모든 상황 시뮬레이션)
- 🎯 정확 (로직만 순수하게 테스트)
- 📊 추적 (호출 여부, 횟수, 인자 확인)
```

---

## 완전한 예제

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Verification } from './entities/verification.entity';
import { JwtService } from 'src/jwt/jwt.service';
import { MailService } from 'src/mail/mail.service';

// 1. Mock 객체 정의
const mockRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    merge: jest.fn(),
};

const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
};

const mockMailService = {
    sendVerificationEmail: jest.fn(),
};

// 2. 타입 정의
type MockRepository<T = any> = Partial<Record<keyof Repository<T>, jest.Mock>>;

describe('UsersService', () => {
    let service: UsersService;
    let usersRepository: MockRepository<User>;

    // 3. 테스트 모듈 생성
    beforeAll(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UsersService,
                {
                    provide: getRepositoryToken(User),
                    useValue: mockRepository,
                },
                {
                    provide: getRepositoryToken(Verification),
                    useValue: mockRepository,
                },
                {
                    provide: JwtService,
                    useValue: mockJwtService,
                },
                {
                    provide: MailService,
                    useValue: mockMailService,
                },
            ],
        }).compile();
        
        // 4. 인스턴스 가져오기
        service = module.get<UsersService>(UsersService);
        usersRepository = module.get(getRepositoryToken(User));
    });

    // Mock 초기화
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    // 5. 테스트 작성
    describe('createAccount', () => {
        it('should fail if user exists', async () => {
            // Arrange
            usersRepository.findOne!.mockResolvedValue({ 
                id: 1, 
                email: 'test@test.com' 
            });
            
            // Act
            const result = await service.createAccount({
                email: 'test@test.com',
                password: 'password',
                role: 0,
            });
            
            // Assert
            expect(result).toMatchObject({ 
                ok: false, 
                error: 'There is a user with that email already' 
            });
            expect(usersRepository.findOne).toHaveBeenCalledTimes(1);
        });
        
        it('should create a new user', async () => {
            // Arrange
            usersRepository.findOne.mockResolvedValue(null);
            usersRepository.create.mockReturnValue({
                email: 'new@test.com',
                password: 'hashed',
                role: 0,
            });
            usersRepository.save.mockResolvedValue({
                id: 1,
                email: 'new@test.com',
            });
            
            // Act
            const result = await service.createAccount({
                email: 'new@test.com',
                password: 'password',
                role: 0,
            });
            
            // Assert
            expect(result).toEqual({ ok: true });
            expect(usersRepository.create).toHaveBeenCalledWith({
                email: 'new@test.com',
                password: 'password',
                role: 0,
            });
            expect(usersRepository.save).toHaveBeenCalled();
        });
    });
});
```

---

## 요약 정리

| 개념 | 역할 | 핵심 |
|------|------|------|
| **Mock** | 가짜 객체 | 실제 DB 없이 테스트 |
| **jest.fn()** | Mock 함수 | 호출 추적 + 동작 제어 |
| **Test.createTestingModule()** | 테스트 환경 구성 | DI 컨테이너 생성 |
| **useValue** | 의존성 대체 | Mock 주입 |
| **module.get()** | 인스턴스 가져오기 | 같은 Mock 참조 |
| **MockRepository** | 타입 안전성 | 필요한 것만 구현 |

### 핵심 철학

> **"실제 DB, 메일, JWT 없이도 UsersService의 로직만 순수하게 테스트하자!"**

이것이 **단위 테스트(Unit Test)**의 본질입니다! 🎯✨

---

## 참고 자료

- [NestJS Testing 공식 문서](https://docs.nestjs.com/fundamentals/testing)
- [Jest 공식 문서](https://jestjs.io/)
- [TypeORM Repository](https://typeorm.io/repository-api)

