PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_package_releases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`package_id` integer NOT NULL,
	`version` text NOT NULL,
	`leios_patch` text,
	`architecture` text NOT NULL,
	FOREIGN KEY (`package_id`) REFERENCES `packages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_package_releases`("id", "package_id", "version", "leios_patch", "architecture") SELECT "id", "package_id", "version", "leios_patch", "architecture" FROM `package_releases`;--> statement-breakpoint
DROP TABLE `package_releases`;--> statement-breakpoint
ALTER TABLE `__new_package_releases` RENAME TO `package_releases`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `packages` ADD `requires_patching` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `stable_promotion_requests_package_release_id_unique` ON `stable_promotion_requests` (`package_release_id`);