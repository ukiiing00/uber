# 구조적 타이핑과 모킹 (Structural Typing in Mocking)

## 개요

TypeScript는 **구조적 타이핑(Structural Typing)**을 사용합니다. 이는 객체가 특정 타입의 모든 속성을 가질 필요 없이, **실제로 사용되는 속성만** 있으면 해당 타입으로 인정된다는 의미입니다.

이 원리는 테스트 코드에서 Mock 객체를 만들 때 매우 유용하게 활용됩니다.

## 구조적 타이핑의 원리

### TypeScript vs 명목적 타이핑

```typescript
// User 엔티티는 많은 속성을 가지고 있습니다
interface User {
    id: number;
    email: string;
    password: string;
    role: UserRole;
    verified: boolean;
    createdAt: Date;
    updatedAt: Date;
    // ... 기타 속성들
}

// ❌ 명목적 타이핑 (Java, C# 등)
// 반드시 User 클래스의 인스턴스여야 함

// ✅ 구조적 타이핑 (TypeScript)
// User가 가진 속성 중 실제로 사용되는 것만 있으면 됨
const partialUser = { 
    verified: true, 
    email: 'test@test.com' 
};
// 이 객체는 User로 취급될 수 있습니다!
```

## 테스트에서의 활용

### 1. 불필요한 속성 제거

실제 서비스 코드에서 사용되는 속성만 Mock하면 됩니다.

```typescript
// users.service.ts - editProfile()
async editProfile(userId: number, editProfileInput: EditProfileInput) {
    const user = await this.users.findOne({ where: { id: userId } });
    
    if (editProfileInput.email) {
        user.email = editProfileInput.email;        // ✅ email 사용
        user.verified = false;                       // ✅ verified 사용
        
        const verification = this.verifications.create({
            user: user,  // user 객체를 그대로 전달
        });
    }
    // id, password, role, createdAt, updatedAt는 사용하지 않음
}
```

### 2. 테스트 코드에서의 Mock

```typescript
it('should edit user email', async () => {
    // ✅ 실제로 사용되는 속성만 mock
    const oldUser = { 
        verified: true, 
        email: 'test@test.com' 
    };
    const editProfileInput = { 
        userId: 1, 
        input: { email: 'test2@test.com' }
    };
    
    usersRepository.findOne!.mockResolvedValue(oldUser);
    
    await service.editProfile(editProfileInput.userId, editProfileInput.input);
    
    // ✅ verificationsRepository.create()에 전달되는 user도
    // verified와 email만 있으면 충분!
    expect(verificationsRepository.create).toHaveBeenCalledWith({
        user: {
            verified: false,
            email: editProfileInput.input.email
        }
    });
});
```

## 장점

### 1. 테스트 속도 향상
불필요한 데이터를 생성하지 않아 테스트가 빠릅니다.

```typescript
// ❌ 느리고 복잡
const oldUser = {
    id: 1,
    email: 'test@test.com',
    password: await bcrypt.hash('password', 10),  // 불필요한 해싱
    role: UserRole.Client,
    verified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    // ... 20개 이상의 속성
};

// ✅ 빠르고 간결
const oldUser = {
    verified: true,
    email: 'test@test.com'
};
```

### 2. 테스트 가독성
테스트하려는 내용이 명확하게 드러납니다.

```typescript
it('should edit user email', async () => {
    // 이 테스트에서 중요한 것은 verified와 email뿐
    const oldUser = { verified: true, email: 'test@test.com' };
    
    // 한눈에 무엇을 테스트하는지 알 수 있음
    expect(user.verified).toBe(false);
    expect(user.email).toBe('test2@test.com');
});
```

### 3. 유지보수 용이
엔티티에 새 속성이 추가되어도 기존 테스트가 깨지지 않습니다.

```typescript
// User 엔티티에 새로운 속성이 추가됨
interface User {
    id: number;
    email: string;
    // ... 기존 속성들
    phoneNumber?: string;  // ✅ 새로 추가
    address?: string;       // ✅ 새로 추가
}

// ❌ 모든 속성을 mock한 경우 → 테스트 수정 필요
const oldUser = {
    id: 1,
    email: 'test@test.com',
    // phoneNumber?: ???  // 추가해야 함
    // address?: ???       // 추가해야 함
};

// ✅ 필요한 속성만 mock한 경우 → 수정 불필요
const oldUser = {
    verified: true,
    email: 'test@test.com'
};
```

### 4. 격리된 테스트
테스트하려는 로직에만 집중할 수 있습니다.

```typescript
describe('editProfile - email change', () => {
    it('should update email and set verified to false', async () => {
        // 이 테스트는 email과 verified에만 관심이 있음
        const oldUser = { verified: true, email: 'old@test.com' };
        
        // password, role, createdAt 등은 이 테스트와 무관
        // 따라서 mock할 필요가 없음
    });
});
```

## 실전 예제: user.service.spec.ts

### 케이스 1: 로그인 테스트

```typescript
it('should fail if password is incorrect', async () => {
    // User 전체가 아닌, 필요한 메서드만 mock
    const mockedUser = {
        id: 1,
        checkPassword: jest.fn(() => Promise.resolve(false)),
    };
    
    usersRepository.findOne!.mockResolvedValue(mockedUser);
    const result = await service.login(loginArgs);
    
    expect(result).toMatchObject({ ok: false, error: 'Wrong password' });
});
```

### 케이스 2: 사용자 조회 테스트

```typescript
it('should return user if found', async () => {
    // findById는 id와 email만 반환
    const mockedUser = {
        id: 1,
        email: 'test@test.com',
    };
    
    usersRepository.findOne!.mockResolvedValue(mockedUser);
    const result = await service.findById(1);
    
    expect(result).toMatchObject({ ok: true, user: mockedUser });
});
```

### 케이스 3: 프로필 수정 테스트

```typescript
it('should edit user email', async () => {
    // email 변경 테스트는 verified와 email만 필요
    const oldUser = { verified: true, email: 'test@test.com' };
    const editProfileInput = { 
        userId: 1, 
        input: { email: 'test2@test.com' }
    };

    usersRepository.findOne!.mockResolvedValue(oldUser);
    verificationsRepository.create!.mockReturnValue({ code: 'code' });

    await service.editProfile(editProfileInput.userId, editProfileInput.input);
    
    expect(verificationsRepository.create).toHaveBeenCalledWith({
        user: {
            verified: false,
            email: editProfileInput.input.email
        }
    });
});
```

## 모범 사례 (Best Practices)

### 1. 테스트 대상 로직 분석
먼저 테스트하려는 메서드가 어떤 속성을 사용하는지 파악합니다.

```typescript
// 1단계: 실제 코드 분석
async editProfile(userId: number, editProfileInput: EditProfileInput) {
    const user = await this.users.findOne({ where: { id: userId } });
    
    if (editProfileInput.email) {
        user.email = editProfileInput.email;        // email 사용
        user.verified = false;                       // verified 사용
    }
    if (editProfileInput.password) {
        user.password = editProfileInput.password;   // password 사용
    }
}

// 2단계: 필요한 속성만 mock
const oldUser = { 
    verified: true, 
    email: 'test@test.com',
    password: 'oldPassword'  // password 변경 테스트라면 추가
};
```

### 2. 최소한의 Mock 데이터
테스트 케이스별로 필요한 최소한의 데이터만 제공합니다.

```typescript
// ✅ Good: 각 테스트에 필요한 것만
describe('login', () => {
    it('should fail if user not found', async () => {
        usersRepository.findOne!.mockResolvedValue(null);
        // null이면 충분, 다른 속성 불필요
    });

    it('should fail if password is incorrect', async () => {
        const mockedUser = {
            id: 1,
            checkPassword: jest.fn(() => Promise.resolve(false)),
        };
        // id와 checkPassword만 있으면 충분
    });
});
```

### 3. 테스트 간 데이터 재사용 주의
공통 Mock 데이터는 각 테스트의 독립성을 해칠 수 있습니다.

```typescript
// ❌ Bad: 모든 테스트가 같은 객체 참조
const sharedUser = { id: 1, email: 'test@test.com' };

beforeEach(() => {
    // 모든 테스트에서 sharedUser 사용
});

// ✅ Good: 각 테스트에서 필요한 데이터 생성
it('should edit email', async () => {
    const oldUser = { verified: true, email: 'test@test.com' };
    // 이 테스트만의 독립적인 데이터
});

it('should change password', async () => {
    const oldUser = { password: 'oldPass' };
    // 이 테스트만의 독립적인 데이터
});
```

## 주의사항

### 1. 타입 안정성 유지
mock 객체도 TypeScript의 타입 체크를 받도록 합니다.

```typescript
// ❌ any 타입으로 우회
const oldUser: any = { verified: true };

// ✅ Partial 타입 활용
const oldUser: Partial<User> = { verified: true, email: 'test@test.com' };

// ✅ 필요한 속성만 명시
const oldUser: Pick<User, 'verified' | 'email'> = { 
    verified: true, 
    email: 'test@test.com' 
};
```

### 2. 실제 사용과 Mock의 일치
Mock한 속성이 실제로 사용되는지 확인합니다.

```typescript
// ❌ Bad: role을 mock했지만 실제로 사용하지 않음
const oldUser = { 
    verified: true, 
    email: 'test@test.com',
    role: UserRole.Client  // 불필요
};

// ✅ Good: 실제로 사용되는 것만
const oldUser = { 
    verified: true, 
    email: 'test@test.com'
};
```

## 결론

구조적 타이핑은 TypeScript와 테스트의 강력한 조합입니다:

1. **필요한 것만**: 실제로 사용되는 속성만 Mock
2. **간결하게**: 테스트 코드의 가독성 향상
3. **명확하게**: 테스트 의도가 분명히 드러남
4. **유지보수**: 엔티티 변경에도 테스트가 깨지지 않음

이 원리를 잘 활용하면 빠르고, 명확하며, 유지보수하기 쉬운 테스트 코드를 작성할 수 있습니다.

