import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Request,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserFiltersDto } from './dto/user-filters.dto';
import { UsersService } from './users.service';

interface RequestWithUser {
  user?: { id: number; email: string; role: string };
}

@Roles('admin')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@Query() filters: UserFiltersDto) {
    return this.usersService.findAll(filters);
  }

  @Post()
  create(@Body() createDto: CreateUserDto, @Request() req: RequestWithUser) {
    return this.usersService.create(createDto, req.user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateUserDto,
    @Request() req: RequestWithUser,
  ) {
    return this.usersService.update(id, updateDto, req.user);
  }

  @Put(':id')
  updatePut(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateUserDto,
    @Request() req: RequestWithUser,
  ) {
    return this.usersService.update(id, updateDto, req.user);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: RequestWithUser,
  ) {
    const requestingUserId = req.user?.id ?? 0;
    return this.usersService.remove(id, requestingUserId, req.user);
  }
}
