import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class InfrastructureConfig {
  @IsString()
  @IsOptional()
  readonly apiPrefix: string = 'setting-api';

  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  readonly port: number = 3000;

  @IsString()
  @IsNotEmpty()
  readonly dbHost: string = process.env.DB_HOST || 'localhost';

  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  readonly dbPort: number = parseInt(process.env.DB_PORT || '5432', 10);

  @IsString()
  @IsNotEmpty()
  readonly dbName: string = process.env.DB_NAME || 'hrms_setting';

  @IsString()
  @IsNotEmpty()
  readonly dbUsername: string = process.env.DB_USERNAME || 'postgres';

  @IsString()
  @IsOptional()
  readonly dbPassword: string = process.env.DB_PASSWORD || 'postgres';

  @IsString()
  @IsNotEmpty()
  readonly redisHost: string = process.env.REDIS_HOST || 'localhost';

  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  readonly redisPort: number = parseInt(process.env.REDIS_PORT || '6379', 10);
}
