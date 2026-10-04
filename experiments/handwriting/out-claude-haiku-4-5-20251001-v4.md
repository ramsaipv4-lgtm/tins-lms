Warning: no stdin data received in 3s, proceeding without it. If piping from a slow command, redirect stdin explicitly: < /dev/null to skip, or wait longer.
```markdown
# Example

m = 4

| 1 | 2 | 3 | 4 |
|---|---|---|---|
| * | * | * | * |
| * | * | * |   |
| * | * |   |   |
| * |   |   |   |

# Known

Row & Column start@Value1

# Ans/Solution

```c
for(int i=1; i<=m; i++){
  for(int j=1; j<=m; j++){
    if (i<=j){
      printf("*");
    }
    else {
      break;
    }
  }
  printf("\n");
}
return 0;
```

# Observation

1. Right angle triangle
2. Print only if column value is less than Row Value

# Assumption

1) Outer loop = Row
2) Inner loop = Column

# TRACE TABLE

| Row (i) | Column (j) | Condition (i<=j) | Output |
|---------|-----------|------------------|--------|
| 1       | 1         | 1<=1             | *      |
| 1       | 2         | 2<=1             | +      |
| 1       | 3         | [obscured]       | +      |
| 1       | 4         | [obscured]       | +      |
| 2       | 1         | 1<=2             | +      |
| 2       | 2         | 2<=2             | +      |
| 2       | 3         | [obscured]       | +      |
| 2       | 4         | [obscured]       | +      |
| 3       | 1         | 1<=3             | +      |
| 3       | 2         | 2<=3             | +      |
| 3       | 3         | 3<=3             | +      |
| 3       | 4         | [obscured]       | +      |
| 4       | 1         | 1<=4             | +      |
| 4       | 2         | 2<=4             | +      |
| 4       | 3         | 3<=4             | +      |
| 4       | 4         | 4<=4             | +      |

Example: m = 4
Output:
```
1
2 2
3 2 3
4 2 2 9
```
```
