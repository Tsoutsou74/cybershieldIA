from pydantic import BaseModel, EmailStr, Field

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    full_name: str = Field(default="", max_length=120)

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)

class EmailOtpCode(BaseModel):
    code: str = Field(pattern=r"^\d{6}$")

class ProfileUpdate(BaseModel):
    full_name: str = Field(min_length=1, max_length=120)
    password: str | None = Field(default=None, min_length=8, max_length=72)

class ManagedUserUpdate(BaseModel):
    email: EmailStr | None = None
    full_name: str | None = Field(default=None, min_length=1, max_length=120)
    password: str | None = Field(default=None, min_length=8, max_length=72)
    is_active: bool | None = None

class UserResponse(BaseModel):
    id: int
    email: EmailStr
    is_active: bool
    role: str = "user"
    full_name: str = ""

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str = "user"
