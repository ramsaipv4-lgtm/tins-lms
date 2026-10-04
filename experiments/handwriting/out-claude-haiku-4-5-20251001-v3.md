Warning: no stdin data received in 3s, proceeding without it. If piping from a slow command, redirect stdin explicitly: < /dev/null to skip, or wait longer.
# Example
m = 4

# Known
Row & Column starts @ Value=1

# Ans/Solution

```
printf("main()
print m=4;
  for(int i=1; i<=m; i++)
    for(int j=1; j<=m; j++)
      if(j<=i)
        printf("%d");
        else
          break;
      printf("\n");
return 0;
```

# Observation
1. Right angle triangle
2. Print + only if column Value is less than or equal to Row Value

# TRACE TABLE

| Row (i) | Column (j) | Condition (j<=i) | Output |
|---------|-----------|------------------|--------|
| 1 | 1 | 1<=1 | + |
| 1 | 2 | 2<=1 | break |
| 2 | 1 | 1<=2 | + |
| 2 | 2 | 2<=2 | + |
| 2 | 3 | [obscured] | [obscured] |
| 3 | 1 | 1<=3 | + |
| 3 | 2 | 2<=3 | + |
| 3 | 3 | 3<=3 | + |
| 3 | 4 | [obscured] | [obscured] |

# Assumption
1) Outer loop = Row
2) Inner loop = Glum

# Example
m=4
1
1 2
1 2 3
1 2 3 4
