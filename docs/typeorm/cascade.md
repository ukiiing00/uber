# TypeORM Cascade 옵션

## 개요

Cascade는 부모 엔티티를 저장/삭제할 때 연관된 자식 엔티티도 함께 저장/삭제할 수 있게 해주는 옵션입니다.

## Cascade 종류

```typescript
{
  cascade: true,              // 모든 작업에 cascade 적용
  cascade: ['insert'],        // INSERT 시에만
  cascade: ['update'],        // UPDATE 시에만  
  cascade: ['remove'],        // DELETE 시에만
  cascade: ['insert', 'update']  // 복수 지정 가능
}
```

## 기본 사용법

### Cascade 없이

```typescript
@Entity()
export class Verification extends CoreEntity {
    @OneToOne(() => User)
    @JoinColumn()
    user: User;
}

// 사용 예시
const verification = await verifications.findOne({ 
    where: { code }, 
    relations: ['user'] 
});

verification.user.verified = true;

// User를 명시적으로 저장해야 함
await users.save(verification.user);  // ✅
await verifications.save(verification);  // ❌ User는 저장 안 됨
```

### Cascade 사용

```typescript
@Entity()
export class Verification extends CoreEntity {
    @OneToOne(() => User, { cascade: true })
    @JoinColumn()
    user: User;
}

// 사용 예시
const verification = await verifications.findOne({ 
    where: { code }, 
    relations: ['user'] 
});

verification.user.verified = true;

// Verification 저장 시 User도 자동으로 저장됨
await verifications.save(verification);  // ✅ User도 함께 저장
```

## 실전 예시

### 회원가입 시 Verification 생성

```typescript
// Verification Entity
@Entity()
export class Verification extends CoreEntity {
    @Column()
    code: string;

    @OneToOne(() => User, { cascade: true })
    @JoinColumn()
    user: User;
}

// Service
async createAccount(input: CreateAccountInput) {
    const user = this.users.create({ email, password, role });
    
    // cascade: true이므로 verification 저장 시 user도 저장됨
    const verification = this.verifications.create({ user });
    await this.verifications.save(verification);
    
    // cascade 없다면:
    // await this.users.save(user);  // 먼저 user 저장
    // await this.verifications.save(verification);  // 그 다음 verification 저장
}
```

### 게시글과 댓글 관계

```typescript
@Entity()
export class Post {
    @OneToMany(() => Comment, comment => comment.post, { 
        cascade: ['insert', 'update'] 
    })
    comments: Comment[];
}

@Entity()
export class Comment {
    @ManyToOne(() => Post, post => post.comments)
    post: Post;
    
    @Column()
    content: string;
}

// 사용
const post = new Post();
post.comments = [
    { content: '댓글1' },
    { content: '댓글2' }
];

// post 저장 시 comments도 자동으로 저장됨
await posts.save(post);
```

## Cascade 방향 주의사항

⚠️ **Cascade는 단방향입니다!**

```typescript
// Verification → User (cascade: true)
@Entity()
export class Verification {
    @OneToOne(() => User, { cascade: true })
    user: User;
}

await verifications.save(verification);  // ✅ User도 저장됨
await users.save(user);  // ❌ Verification은 저장 안 됨
```

반대 방향도 cascade를 원하면 양쪽에 설정해야 합니다:

```typescript
@Entity()
export class User {
    @OneToOne(() => Verification, verification => verification.user, { 
        cascade: true 
    })
    verification: Verification;
}

@Entity()
export class Verification {
    @OneToOne(() => User, user => user.verification, { 
        cascade: true 
    })
    user: User;
}
```

## Cascade와 생명주기 훅

Cascade로 저장되어도 **생명주기 훅은 정상적으로 실행됩니다**.

```typescript
@Entity()
export class User {
    @Column()
    password: string;

    @BeforeInsert()
    @BeforeUpdate()
    async hashPassword() {
        this.password = await bcrypt.hash(this.password, 10);
    }
}

// Cascade를 통해 저장해도 hashPassword()가 실행됨
verification.user.password = 'newpassword';
await verifications.save(verification);  // cascade: true
// → @BeforeUpdate 실행됨 ✅
```

## Cascade Remove 주의사항

`cascade: ['remove']` 또는 `cascade: true`는 **부모 삭제 시 자식도 삭제**합니다.

```typescript
@Entity()
export class User {
    @OneToMany(() => Post, post => post.author, { 
        cascade: ['remove']  // ⚠️ 위험!
    })
    posts: Post[];
}

// User 삭제 시 모든 Post도 삭제됨
await users.remove(user);  // 해당 사용자의 모든 게시글도 삭제!
```

### onDelete 옵션과의 차이

```typescript
// cascade: ['remove'] - 애플리케이션 레벨에서 삭제
@OneToMany(() => Post, post => post.author, { cascade: ['remove'] })
posts: Post[];

// onDelete: 'CASCADE' - 데이터베이스 레벨에서 삭제 (FK constraint)
@ManyToOne(() => User, { onDelete: 'CASCADE' })
author: User;
```

## 권장 사항

### ✅ Cascade 사용이 좋은 경우

1. **강한 소유 관계**: 부모가 자식의 생명주기를 완전히 제어
   ```typescript
   // User가 Profile을 완전히 소유
   @OneToOne(() => Profile, { cascade: true })
   profile: Profile;
   ```

2. **편의성**: 여러 엔티티를 한 번에 저장
   ```typescript
   // 주문과 주문 항목들
   @OneToMany(() => OrderItem, item => item.order, { cascade: true })
   items: OrderItem[];
   ```

### ❌ Cascade 사용을 피해야 할 경우

1. **약한 참조 관계**: 독립적으로 존재 가능한 엔티티
   ```typescript
   // Post는 User 없이도 존재 가능할 수 있음
   @ManyToOne(() => User)
   author: User;  // cascade: false (기본값)
   ```

2. **복잡한 비즈니스 로직**: 명시적 제어가 필요한 경우
   ```typescript
   // 각각의 저장 시점을 제어해야 할 때
   await users.save(user);
   // ... 중간 로직 ...
   await verifications.save(verification);
   ```

3. **성능 고려**: 불필요한 연관 엔티티 로드/저장 방지

## 정리

| 특징 | Cascade 있음 | Cascade 없음 |
|------|-------------|-------------|
| 저장 방식 | 부모 저장 시 자식도 저장 | 각각 명시적으로 저장 |
| 코드 간결성 | 높음 | 낮음 |
| 제어 수준 | 낮음 (자동) | 높음 (명시적) |
| 성능 | 연관 엔티티 자동 로드/저장 | 필요한 것만 처리 |
| 사용 시나리오 | 강한 소유 관계 | 약한 참조 관계 |

## 참고

- [TypeORM Relations - Cascade](https://typeorm.io/relations#cascade-options)
- 관련 문서: [select.md](./select.md), [entity-lifecycle.md](./entity-lifecycle.md)

