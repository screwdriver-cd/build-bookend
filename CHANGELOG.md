# CHANGELOG

## 2.0.1

Bug Fixes:
  * Resolve promises before returning them.

## 2.0.0

Breaking changes:
  * `getSetupCommand` and `getTeardownCommand` changed into `getSetupCommands` and `getTeardownCommands` respectively.
  * `getSetupCommands` and `getTeardownCommands` return an array of commands instead of merging into one command.
