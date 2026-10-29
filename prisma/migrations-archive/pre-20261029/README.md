# 旧迁移归档

这里保存新空库基线建立前的 11 个 migration.sql 原始字节及原 migration_lock.toml，manifest.json 记录 SHA-256。它们不位于 Prisma 当前 migrations 路径，不会在新部署中执行。

旧链包含 source 修改早于创建、重复 RouteTransitPort 外键、删除后未恢复的 SailingSchedule 船司外键以及表名大小写混用。旧文件没有存储过程、触发器或数据初始化 DML；现有模型结构由新基线生成，船期来源枚举、索引、关联、默认值及可空字段均保留。

归档不能证明这些字节就是旧数据库最初执行的版本。2026-10-28 本机审查曾发现缓存迁移 checksum 不同；不能据此替换旧库历史或批量标记迁移完成。已有数据库应保留其 _prisma_migrations，先单独核对实际 DDL、数据和原始迁移版本。

当前基线仅适用于新空库。不得将本归档复制回活动 migrations 目录后与新基线一起执行。
