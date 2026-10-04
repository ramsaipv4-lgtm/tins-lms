# Example: m = 4

## Known
Row 2 Column start@Value=1

## Ans/Solution

```
printMain() {
  int m= 4;
  for(int i=1; i<=m; i++) {
    for(int j=1; j<=m; j++) {
      if(j<=i) {
        printf("*d");
      }
      else {
        break;
      }
    }
    printf("\n");
  }
}
return 0;
```

## Observation

1. Right angle triangle
2. Print * only if column Value is less than Row Value

## Assumption

1) Outerloop = Row
2) InnerLoop = glum

## TRACE TABLE

| Row(i) | Column(j) | Condition (j<=i) | Output |
|--------|-----------|------------------|--------|
| 1      | 1         | 1<=1             | ★      |
| 2      | 1         | 1<=2             | ★      |
|        | 2         | 2<=2             | ★      |
| 2      | 1         | 1<=2             | ★      |
|        | 2         | 2<=2             | ★      |
|        | 3         | 3<=3             | ★      |
| 3      | 1         | 1<=3             | ★      |
|        | 2         | 2<=3             | ★      |
|        | 3         | 3<=3             | ★      |

### Example: m=4
```
1
2
2
3
2
3
3
2
3
4
4
4
9
```
