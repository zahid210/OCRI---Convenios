<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     *
     * @return void
     */
    public function run()
    {
        $this->call([
            Convenios2021Seeder::class,
            Convenios2022Seeder::class,
            Convenios2023Seeder::class,
            Convenios2024Seeder::class,
            Convenios2025Seeder::class,
        ]);
    }
}